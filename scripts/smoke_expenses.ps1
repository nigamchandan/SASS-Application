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

$email = "exp_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))@biz.test"
$pw = 'Test1234!'

Write-Host "=== Register ===" -ForegroundColor Cyan
$reg = Hit 'POST' '/auth/register' @{ name = 'Expense Tester'; email = $email; password = $pw }
$token = $reg.data.token
Write-Host "  user: $email"
Write-Host "  token: $($token.Substring(0,16))..."

Write-Host "`n=== Initial summary (empty) ===" -ForegroundColor Cyan
$summary = Hit 'GET' '/expenses/summary' $null $token
Write-Host "  this_month: $($summary.data.total_this_month)  last_month: $($summary.data.total_last_month)  pct_change: $($summary.data.percentage_change)"
Write-Host "  by_month buckets: $($summary.data.by_month.Count)  by_category: $($summary.data.by_category.Count)"

Write-Host "`n=== Initial list (empty) ===" -ForegroundColor Cyan
$list = Hit 'GET' '/expenses?page=1&pageSize=10' $null $token
Write-Host "  total: $($list.data.pagination.total)  filteredTotal: $($list.data.filteredTotal)"

Write-Host "`n=== Create expenses ===" -ForegroundColor Cyan
$today = (Get-Date).ToString('yyyy-MM-dd')
$lastMonth = (Get-Date).AddMonths(-1).ToString('yyyy-MM-15')
$twoMonthsAgo = (Get-Date).AddMonths(-2).ToString('yyyy-MM-10')

$created = @()
$created += (Hit 'POST' '/expenses' @{ title='Electricity Bill'; category='Utilities'; amount=1200; date=$today; description='Monthly EB' } $token).data.expense
$created += (Hit 'POST' '/expenses' @{ title='Office Internet'; category='Utilities'; amount=899; date=$today } $token).data.expense
$created += (Hit 'POST' '/expenses' @{ title='Adobe CC'; category='Software'; amount=4999; date=$today; description='Annual sub' } $token).data.expense
$created += (Hit 'POST' '/expenses' @{ title='Team Lunch'; category='Food & Drinks'; amount=2300; date=$today } $token).data.expense
$created += (Hit 'POST' '/expenses' @{ title='Travel - Bangalore'; category='Travel'; amount=8500; date=$lastMonth; description='Client visit' } $token).data.expense
$created += (Hit 'POST' '/expenses' @{ title='Old Hosting Bill'; category='Software'; amount=1500; date=$twoMonthsAgo } $token).data.expense
foreach ($e in $created) {
  Write-Host "  + $($e.title) ($($e.category)) $($e.amount) on $($e.date)"
}

Write-Host "`n=== Validation: bad payload ===" -ForegroundColor Cyan
try {
  Hit 'POST' '/expenses' @{ title=''; category='Bogus'; amount=-50; date='not-a-date' } $token | Out-Null
  Write-Host "  ERROR: should have failed"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "  OK validation rejected with $code"
}

Write-Host "`n=== Summary after seed ===" -ForegroundColor Cyan
$summary = Hit 'GET' '/expenses/summary' $null $token
Write-Host "  this_month: $($summary.data.total_this_month)"
Write-Host "  last_month: $($summary.data.total_last_month)"
Write-Host "  percentage_change: $($summary.data.percentage_change)%"
Write-Host "  total_all_time: $($summary.data.total_all_time)  count_all_time: $($summary.data.count_all_time)"
Write-Host "  by_month (6 buckets):"
foreach ($b in $summary.data.by_month) { Write-Host "    $($b.label.PadRight(8)) total=$($b.total) count=$($b.count)" }
Write-Host "  by_category (this month):"
foreach ($c in $summary.data.by_category) { Write-Host "    $($c.category.PadRight(20)) total=$($c.total) count=$($c.count)" }

Write-Host "`n=== List filters ===" -ForegroundColor Cyan
$list1 = Hit 'GET' '/expenses?category=Software' $null $token
Write-Host "  category=Software -> $($list1.data.pagination.total) entries, filteredTotal=$($list1.data.filteredTotal)"

$list2 = Hit 'GET' "/expenses?q=team" $null $token
Write-Host "  q=team -> $($list2.data.pagination.total) entries"

$list3 = Hit 'GET' "/expenses?dateFrom=$lastMonth&dateTo=$lastMonth" $null $token
Write-Host "  dateFrom/dateTo last month single day -> $($list3.data.pagination.total) entries"

$listSorted = Hit 'GET' '/expenses?sortBy=amount&sortOrder=desc&pageSize=3' $null $token
Write-Host "  top-3 by amount:"
foreach ($e in $listSorted.data.expenses) { Write-Host "    $($e.title.PadRight(24)) $($e.amount)" }

Write-Host "`n=== Update one expense ===" -ForegroundColor Cyan
$first = $created[0]
$upd = Hit 'PATCH' "/expenses/$($first.id)" @{ amount=1350; description='Bumped after meter reading' } $token
Write-Host "  updated $($upd.data.expense.title) to $($upd.data.expense.amount)"

Write-Host "`n=== Delete one expense ===" -ForegroundColor Cyan
$last = $created[-1]
Hit -method 'DELETE' -path "/expenses/$($last.id)" -token $token | Out-Null
Write-Host "  deleted $($last.title)"

Write-Host "`n=== Tenant isolation ===" -ForegroundColor Cyan
$other = Hit 'POST' '/auth/register' @{ name='Other'; email = "other_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))@biz.test"; password=$pw }
$otherToken = $other.data.token
$otherList = Hit 'GET' '/expenses' $null $otherToken
Write-Host "  other user sees $($otherList.data.pagination.total) entries (expected 0)"

try {
  Hit 'GET' "/expenses/$($created[1].id)" $null $otherToken | Out-Null
  Write-Host "  ERROR: cross-tenant fetch succeeded"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "  OK cross-tenant fetch blocked with $code"
}

Write-Host "`n=== Final list page ===" -ForegroundColor Cyan
$final = Hit 'GET' '/expenses?page=1&pageSize=10' $null $token
Write-Host "  total: $($final.data.pagination.total)  filteredTotal: $($final.data.filteredTotal)"
foreach ($e in $final.data.expenses) {
  Write-Host "    $($e.date.Substring(0,10))  $($e.title.PadRight(22))  $($e.category.PadRight(18))  $($e.amount)"
}

Write-Host "`nALL OK" -ForegroundColor Green
