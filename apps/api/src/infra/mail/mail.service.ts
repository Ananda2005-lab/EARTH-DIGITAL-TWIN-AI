import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { AppConfig } from 'src/config/configuration';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Transactional email. When SMTP is not configured the message is logged at
 * debug level without its body, so local development works without a mail server
 * and credentials never reach the logs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(message: MailMessage): Promise<boolean> {
    const mail = this.config.get('mail', { infer: true });
    if (!mail.enabled || !mail.host) {
      this.logger.debug(
        `Mail suppressed (transport disabled): "${message.subject}" → ${message.to}`,
      );
      return false;
    }

    try {
      this.transporter ??= createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: mail.user && mail.password ? { user: mail.user, pass: mail.password } : undefined,
      });
      await this.transporter.sendMail({
        from: mail.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to deliver "${message.subject}": ${(error as Error).message}`);
      return false;
    }
  }

  async sendVerification(to: string, name: string, token: string): Promise<boolean> {
    const url = `${this.config.get('webAppUrl', { infer: true })}/auth/verify-email?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: 'Confirm your Earth Digital Twin account',
      text: `Hi ${name},\n\nConfirm your email address to activate your account:\n${url}\n\nThe link expires soon. If you did not sign up, ignore this message.`,
    });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<boolean> {
    const url = `${this.config.get('webAppUrl', { infer: true })}/auth/reset-password?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: 'Reset your Earth Digital Twin password',
      text: `Hi ${name},\n\nReset your password here:\n${url}\n\nIf you did not request this, no action is needed — your password is unchanged.`,
    });
  }

  async sendPasswordChanged(to: string, name: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Your Earth Digital Twin password changed',
      text: `Hi ${name},\n\nYour password was just changed and all other sessions were signed out. If this was not you, reset your password immediately.`,
    });
  }

  async sendHazardAlert(to: string, title: string, body: string): Promise<boolean> {
    return this.send({ to, subject: `Hazard alert: ${title}`, text: body });
  }
}
