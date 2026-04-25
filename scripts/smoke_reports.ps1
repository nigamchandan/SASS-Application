$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5000/api'

function J($obj) { $obj | ConvertTo-Json -Depth 6 -Compress }
function Hit($method, $path, $body = $null, $token = $null) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers }
  if ($null -ne $body) { $params['Body'] = (J $body) }
  return Invoke-RestMethod @params
}

$email = "rep_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))@biz.test"
$pw = 'Test1234!'

Write-Host "=== Register ===" -ForegroundColor Cyan
$reg = Hit 'POST' '/auth/register' @{ name = 'Reports Tester'; email = $email; password = $pw }
$token = $reg.data.token
Write-Host "  user: $email"

Write-Host "`n=== Empty report ===" -ForegroundColor Cyan
$empty = Hit 'GET' '/reports/summary?range=this_month' $null $token
Write-Host "  range: $($empty.data.range.key)  granularity: $($empty.data.range.granularity)"
Write-Host "  revenue: $($empty.data.kpis.revenue)  expenses: $($empty.data.kpis.expenses)  profit: $($empty.data.kpis.profit)"
Write-Host "  series buckets: $($empty.data.series.Count)"

Write-Host "`n=== Validation: bad range ===" -ForegroundColor Cyan
try {
  Hit 'GET' '/reports/summary?range=bogus' $null $token | Out-Null
  Write-Host "  ERROR: should have failed"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "  OK rejected with $code"
}

Write-Host "`n=== Seed data: customer + invoice + payment + expense ===" -ForegroundColor Cyan
$cust = (Hit 'POST' '/customers' @{ name='Acme Corp'; email='ap@acme.test'; phone='+91 9876500001' } $token).data.customer
Write-Host "  customer: $($cust.name) ($($cust.id))"

$inv1 = (Hit 'POST' '/invoices' @{
  customerId = $cust.id
  items = @(
    @{ itemName='Consulting'; quantity=2; price=5000; tax=18 },
    @{ itemName='Setup fee'; quantity=1; price=2000; tax=18 }
  )
} $token).data.invoice
Write-Host "  invoice: $($inv1.invoiceNumber)  total=$($inv1.totalAmount)  tax=$($inv1.taxAmount)"

$cust2 = (Hit 'POST' '/customers' @{ name='Globex Ltd'; email='gx@globex.test' } $token).data.customer
$inv2 = (Hit 'POST' '/invoices' @{
  customerId = $cust2.id
  items = @(@{ itemName='Maintenance'; quantity=1; price=3000; tax=18 })
} $token).data.invoice
Write-Host "  invoice: $($inv2.invoiceNumber)  total=$($inv2.totalAmount)  tax=$($inv2.taxAmount)"

# Record payments today
$today = (Get-Date).ToString('yyyy-MM-dd')
$pay1 = (Hit 'POST' "/invoices/$($inv1.id)/payments" @{ amount=$inv1.totalAmount; paymentDate=$today; method='UPI' } $token).data.payment
Write-Host "  payment full for $($inv1.invoiceNumber): $($pay1.amount) via $($pay1.method)"
$pay2 = (Hit 'POST' "/invoices/$($inv2.id)/payments" @{ amount=2000; paymentDate=$today; method='BANK' } $token).data.payment
Write-Host "  partial payment for $($inv2.invoiceNumber): $($pay2.amount)"

# Expenses across categories
$exp = @(
  @{ title='Electricity'; category='Utilities'; amount=1200; date=$today },
  @{ title='Adobe CC'; category='Software'; amount=4999; date=$today },
  @{ title='Office Rent'; category='Rent'; amount=18000; date=$today },
  @{ title='Team Lunch'; category='Food & Drinks'; amount=2300; date=$today }
)
foreach ($e in $exp) {
  $r = Hit 'POST' '/expenses' $e $token
  Write-Host "  expense: $($r.data.expense.title) ($($r.data.expense.category)) $($r.data.expense.amount)"
}

Write-Host "`n=== This month report ===" -ForegroundColor Cyan
$rep = Hit 'GET' '/reports/summary?range=this_month' $null $token
$k = $rep.data.kpis
Write-Host "  revenue:  $($k.revenue)  (prev $($k.revenue_prev), delta $($k.revenue_pct)%)"
Write-Host "  expenses: $($k.expenses) (prev $($k.expenses_prev), delta $($k.expenses_pct)%)"
Write-Host "  profit:   $($k.profit)   (prev $($k.profit_prev), delta $($k.profit_pct)%)"
Write-Host "  margin:   $($k.margin)%"
Write-Host "  tax:      $($k.tax)  invoiced: $($k.invoiced)  invoices: $($k.invoice_count)"
Write-Host "  series:   $($rep.data.series.Count) buckets ($($rep.data.range.granularity))"
$nonZero = $rep.data.series | Where-Object { $_.revenue -ne 0 -or $_.expenses -ne 0 }
foreach ($s in $nonZero) { Write-Host "    $($s.label.PadRight(8)) rev=$($s.revenue) exp=$($s.expenses) profit=$($s.profit)" }

Write-Host "  expenses_by_category:"
foreach ($c in $rep.data.expenses_by_category) { Write-Host "    $($c.category.PadRight(20)) total=$($c.total) count=$($c.count)" }

Write-Host "  top_customers:"
foreach ($c in $rep.data.top_customers) { Write-Host "    $($c.name.PadRight(18)) revenue=$($c.revenue) invoices=$($c.invoiceCount)" }

Write-Host "  invoice_status:"
Write-Host "    total=$($rep.data.invoice_status.total)"
Write-Host "    paid=$($rep.data.invoice_status.paid.count) ($($rep.data.invoice_status.paid.total))"
Write-Host "    unpaid=$($rep.data.invoice_status.unpaid.count) ($($rep.data.invoice_status.unpaid.total))"
Write-Host "    overdue=$($rep.data.invoice_status.overdue.count) ($($rep.data.invoice_status.overdue.total))"

Write-Host "`n=== Last month (should be empty) ===" -ForegroundColor Cyan
$lm = Hit 'GET' '/reports/summary?range=last_month' $null $token
Write-Host "  revenue=$($lm.data.kpis.revenue) expenses=$($lm.data.kpis.expenses) profit=$($lm.data.kpis.profit)"
Write-Host "  series buckets=$($lm.data.series.Count) (granularity $($lm.data.range.granularity))"

Write-Host "`n=== This year (should match this_month since all activity is today) ===" -ForegroundColor Cyan
$y = Hit 'GET' '/reports/summary?range=this_year' $null $token
Write-Host "  revenue=$($y.data.kpis.revenue) expenses=$($y.data.kpis.expenses) granularity=$($y.data.range.granularity) buckets=$($y.data.series.Count)"

Write-Host "`n=== Custom range (last 7 days) ===" -ForegroundColor Cyan
$from = (Get-Date).AddDays(-6).ToString('yyyy-MM-dd')
$to = (Get-Date).ToString('yyyy-MM-dd')
$cust1 = Hit 'GET' "/reports/summary?range=custom&from=$from&to=$to" $null $token
Write-Host "  custom $from..$to  rev=$($cust1.data.kpis.revenue) exp=$($cust1.data.kpis.expenses) granularity=$($cust1.data.range.granularity) buckets=$($cust1.data.series.Count)"

Write-Host "`n=== CSV export ===" -ForegroundColor Cyan
$csvUri = "$base/reports/export.csv?range=this_month"
$resp = Invoke-WebRequest -Uri $csvUri -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
Write-Host "  status: $($resp.StatusCode)  bytes: $($resp.RawContentLength)"
Write-Host "  filename: $($resp.Headers['Content-Disposition'])"
$csv = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { [string]$resp.Content }
$lines = $csv -split "`n"
Write-Host "  first 6 lines:"
foreach ($line in $lines[0..[Math]::Min(5, $lines.Count - 1)]) { Write-Host "    $line" }

Write-Host "`n=== Tenant isolation ===" -ForegroundColor Cyan
$other = Hit 'POST' '/auth/register' @{ name='Other'; email = "other_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))@biz.test"; password=$pw }
$otherToken = $other.data.token
$otherReport = Hit 'GET' '/reports/summary?range=this_month' $null $otherToken
Write-Host "  other user revenue=$($otherReport.data.kpis.revenue) expenses=$($otherReport.data.kpis.expenses) (expected 0)"

Write-Host "`nALL OK" -ForegroundColor Green
