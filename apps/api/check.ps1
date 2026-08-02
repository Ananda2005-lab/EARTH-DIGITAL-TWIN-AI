$out = @()
Push-Location ..\..
$msg = 'chore: baseline after audit fixes'
& git init -q
$out += "INIT_EXIT=$LASTEXITCODE"
& git add -A
$out += "ADD_EXIT=$LASTEXITCODE"
$out += "STAGED=" + (@(& git diff --cached --name-only).Count)
& git -c user.name=kiro -c user.email=kiro@local commit -q -m $msg
$out += "COMMIT_EXIT=$LASTEXITCODE"
$out += @(& git log --oneline)
Pop-Location
Set-Content -Path check-result.txt -Value $out -Encoding utf8
