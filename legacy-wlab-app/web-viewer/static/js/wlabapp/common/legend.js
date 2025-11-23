/* 
	WeatherLab legend.js
	$Rev: 239 $
	$Author: kkuras $
	$Date: 2018-01-04 19:06:50 +0100 (czw) $
*/
var legend_daily_base = 
`
<div class="container-fluid">
	<div class="col-sm-3">
		<dl>
		<dt>ACT</dt>
		<dd>ostatni pomiar</dd>
		<dt>AVG</dt>
		<dd>średnia dobowa</dd>
		</dl>
	</div>
	<div class="col-sm-3">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum dobowe</dd>
		<dt>MIN</dt>
		<dd>minimum dobowe</dd>
		</dl>
	</div>
	<div class="col-sm-3">
		<dl>
		<dt>T_MIN</dt>
		<dd>godzina wystąpienia MIN</dd>
		<dt>T_MAX</dt>
		<dd>godzina wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="col-sm-3">
		<dl>
		<dt>T_ACT</dt>
		<dd>czas ostatniego pomiaru</dd>
		</dl>
	</div>
</div>
`;

var legend_daily_chart_base =
`
<div class="container-fluid">
	<div class="row">
		<dl>
		<dt>TS</dt>
		<dd>czas pomiaru</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>ACT</dt>
		<dd>wartość w czasie TS</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>AVG</dt>
		<dd>średnia od poprzedniego pomiaru</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum od poprzedniego pomiaru</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MAX</dt>
		<dd>godzina wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MIN</dt>
		<dd>minimum od poprzedniego pomiaru</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MIN</dt>
		<dd>godzina wystąpienia MIN</dd>
		</dl>
	</div>
</div>
`;

var legend_monthly_chart_base =
`
<div class="container-fluid">
	<div class="row">
		<dl>
		<dt>DAY</dt>
		<dd>dzień miesiąca</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>AVG</dt>
		<dd>średnia dobowa</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum dobowe</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MAX</dt>
		<dd>godzina wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MIN</dt>
		<dd>minimum dobowe</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MIN</dt>
		<dd>godzina wystąpienia MIN</dd>
		</dl>
	</div>
</div>
`;

var legend_yearly_chart_base =
`
<div class="container-fluid">
	<div class="row">
		<dl>
		<dt>MONTH</dt>
		<dd>miesiąc</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>AVG</dt>
		<dd>średnia miesiąca</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum miesięczne</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MAX</dt>
		<dd>data wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>MIN</dt>
		<dd>minimum miesięczne</dd>
		</dl>
	</div>
	<div class="row">
		<dl>
		<dt>T_MIN</dt>
		<dd>data występienia MIN</dd>
		</dl>
	</div>
</div>
`;

function legend_yearlyChart(cont_id)
{
	var workAreaEl = document.getElementById(cont_id);
	workAreaEl.innerHTML = legend_yearly_chart_base;
}

function legend_monthlyChart(cont_id)
{
	var workAreaEl = document.getElementById(cont_id);
	workAreaEl.innerHTML = legend_monthly_chart_base;
}

function legend_dailyChart(cont_id)
{
	var workAreaEl = document.getElementById(cont_id);
	workAreaEl.innerHTML = legend_daily_chart_base;
}

/** function legend_dailySample
 * cont_id - container id for legend
 */
function legend_dailySample(cont_id)
{
	var workAreaEl = document.getElementById(cont_id);
	workAreaEl.innerHTML = legend_daily_base;
}
/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */