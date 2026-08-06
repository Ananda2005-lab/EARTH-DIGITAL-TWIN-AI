import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, LiveBadge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the requested variant class', () => {
    const { container } = render(<Badge variant="success">Ok</Badge>);
    expect(container.firstChild).toHaveClass('text-success');
  });

  it('merges a custom className', () => {
    const { container } = render(<Badge className="custom-x">Ok</Badge>);
    expect(container.firstChild).toHaveClass('custom-x');
  });
});

describe('LiveBadge', () => {
  it('renders a live dot and default label', () => {
    const { container } = render(<LiveBadge />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(container.querySelector('.live-dot')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<LiveBadge label="Streaming" />);
    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });
});
