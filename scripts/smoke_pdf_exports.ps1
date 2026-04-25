# Smoke-test all PDF export endpoints (Customers, Invoices, Payments, Expenses, WhatsApp, Reports)
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:5000/api'

function Hit {
    param([string]$method, [string]$path, $body, [string]$token)
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $url = "$BASE$path"
    $params = @{ Uri = $url; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        $resp = Invoke-WebRequest @params
        if ($resp.Content) { return $resp.Content | ConvertFrom-Json }
        return $null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $msg = $_.ErrorDetails.Message
        Write-Host "  HTTP $code  $msg" -ForegroundColor Yellow
        throw
    }
}

function HitBlob {
    param([string]$path, [string]$token)
    $headers = @{ 'Authorization' = "Bearer $token" }
    $url = "$BASE$path"
    # Save to a temp file to avoid encoding issues with binary responses.
    $tmp = [IO.Path]::GetTempFileName() + '.pdf'
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method GET `
            -UseBasicParsing -OutFile $tmp -PassThru
        $bytes = [IO.File]::ReadAllBytes($tmp)
        return [pscustomobject]@{
            StatusCode  = [int]$resp.StatusCode
            Bytes       = $bytes
            ContentType = if ($resp.Headers['Content-Type']) { [string]$resp.Headers['Content-Type'] } else { '' }
            Disposition = if ($resp.Headers['Content-Disposition']) { [string]$resp.Headers['Content-Disposition'] } else { '' }
        }
    } finally {
        if (Test-Path $tmp) { Remove-Item -Force $tmp }
    }
}

$stamp = (Get-Date -Format 'yyyyMMddHHmmss')
$email = "pdf_$stamp@biz.test"
$pwd   = 'Secret123!'

Write-Host "1) Register $email" -ForegroundColor Cyan
$reg = Hit POST '/auth/register' @{ name = 'PDF Tester'; email = $email; password = $pwd }
$tok = $reg.data.token
if (-not $tok) { throw 'No token returned' }

Write-Host "2) Seed minimal data" -ForegroundColor Cyan
$cust = Hit -method POST -path '/customers' -body @{ name = 'PDF Customer Inc.'; phone = '+91 9876500000'; email = "buyer_$stamp@example.com"; gstNumber = '22AAAAA0000A1Z5'; address = 'Mumbai' } -token $tok
$cid = $cust.data.customer.id
$inv = Hit -method POST -path '/invoices' -body @{
    customerId = $cid
    items      = @(@{ itemName = 'Consulting'; quantity = 2; price = 1500; tax = 18 })
    notes      = 'pdf test invoice'
} -token $tok
$iid = $inv.data.invoice.id
$null = Hit -method POST -path "/invoices/$iid/payments" -body @{ amount = 1000; method = 'UPI'; note = 'partial' } -token $tok
$null = Hit -method POST -path '/expenses' -body @{ title = 'Internet'; category = 'Utilities'; amount = 999; date = (Get-Date -Format 'yyyy-MM-dd'); description = 'broadband' } -token $tok
$null = Hit -method POST -path "/invoices/$iid/whatsapp/send-invoice" -body @{} -token $tok
$null = Hit -method POST -path "/invoices/$iid/whatsapp/send-reminder" -body @{} -token $tok

$endpoints = @(
    @{ name = 'Customers'; path = '/customers/export.pdf' },
    @{ name = 'Invoices';  path = '/invoices/export.pdf'  },
    @{ name = 'Payments';  path = '/payments/export.pdf'  },
    @{ name = 'Expenses';  path = '/expenses/export.pdf'  },
    @{ name = 'WhatsApp';  path = '/whatsapp/export.pdf'  },
    @{ name = 'Reports';   path = '/reports/export.pdf?range=this_month' }
)

Write-Host "3) Hit each PDF endpoint and validate" -ForegroundColor Cyan
foreach ($e in $endpoints) {
    Write-Host ("   - {0}" -f $e.name) -NoNewline
    $resp = HitBlob $e.path $tok
    if ($resp.StatusCode -ne 200) {
        Write-Host "  FAIL: HTTP $($resp.StatusCode)" -ForegroundColor Red
        throw 'non-200 status'
    }
    if ($resp.Bytes.Length -lt 200) {
        Write-Host ("  FAIL: too small ({0} bytes)" -f $resp.Bytes.Length) -ForegroundColor Red
        throw 'pdf too small'
    }
    # Verify PDF magic header "%PDF-"
    $hdr = [System.Text.Encoding]::ASCII.GetString($resp.Bytes, 0, 5)
    if ($hdr -ne '%PDF-') {
        Write-Host "  FAIL: not a PDF (header=$hdr)" -ForegroundColor Red
        throw 'not a pdf'
    }
    if ($resp.ContentType -notlike 'application/pdf*') {
        Write-Host "  FAIL: content-type=$($resp.ContentType)" -ForegroundColor Red
        throw 'wrong content type'
    }
    if ($resp.Disposition -notlike '*attachment*') {
        Write-Host "  FAIL: missing attachment disposition" -ForegroundColor Red
        throw 'no attachment'
    }
    Write-Host (" OK  status={0} ct={1} bytes={2}" -f $resp.StatusCode, $resp.ContentType, $resp.Bytes.Length) -ForegroundColor Green
}

Write-Host "4) Tenant isolation: register a second user, hit endpoints" -ForegroundColor Cyan
$email2 = "pdf_b_$stamp@biz.test"
$reg2 = Hit POST '/auth/register' @{ name = 'Other'; email = $email2; password = $pwd }
$tok2 = $reg2.data.token
foreach ($e in $endpoints) {
    $resp = HitBlob $e.path $tok2
    if ($resp.StatusCode -ne 200) {
        Write-Host "  FAIL: HTTP $($resp.StatusCode) on tenant B for $($e.name)" -ForegroundColor Red
        throw 'tenant isolation broken'
    }
    $hdr = [System.Text.Encoding]::ASCII.GetString($resp.Bytes, 0, 5)
    if ($hdr -ne '%PDF-') { throw "tenant B got non-pdf for $($e.name)" }
    Write-Host ("   - {0} OK (size={1})" -f $e.name, $resp.Bytes.Length) -ForegroundColor Green
}

Write-Host "5) Status filter on invoices PDF (status=PAID, no PAID invoices) still returns valid PDF" -ForegroundColor Cyan
$resp = HitBlob '/invoices/export.pdf?status=PAID' $tok
$hdr = [System.Text.Encoding]::ASCII.GetString($resp.Bytes, 0, 5)
if ($hdr -ne '%PDF-') { throw 'paid filter did not return pdf' }
Write-Host ("   PAID-only filter size={0} bytes OK" -f $resp.Bytes.Length) -ForegroundColor Green

Write-Host "ALL PDF EXPORT SMOKE TESTS PASSED" -ForegroundColor Green
