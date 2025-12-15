# PowerShell script to deploy Lambda function
# Run this from the airtable-dashboard directory

Write-Host "Creating Lambda deployment package..." -ForegroundColor Cyan

# Create ZIP file
$zipPath = "lambda_deployment.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath
}

Compress-Archive -Path "lambda_function.py" -DestinationPath $zipPath

Write-Host "ZIP file created: $zipPath" -ForegroundColor Green

# Upload to AWS Lambda
Write-Host "`nUploading to AWS Lambda..." -ForegroundColor Cyan

aws lambda update-function-code `
    --function-name textract-finish-to-csv `
    --zip-file fileb://$zipPath `
    --region us-east-2

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Test by uploading a credit card statement" -ForegroundColor White
    Write-Host "2. Check CloudWatch logs for DEBUG messages" -ForegroundColor White
    Write-Host "3. Verify QBO file contains CREDITCARDMSGSRSV1 tags" -ForegroundColor White
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Make sure AWS CLI is configured and you have permissions." -ForegroundColor Yellow
}
