/* 
	WeatherLab mchart.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/

var mchart_table_head = 
`
<tr>
	<th style="text-align: center;">DAY</th>
	<th style="text-align: center;">AVG</th>
	<th style="text-align: center;">MAX</th>
	<th style="text-align: center;">T_MAX</th>
	<th style="text-align: center;">MIN</th>
	<th style="text-align: center;">T_MIN</th>
</tr>	
`

var mchart_table_legend = 
`
<div class="row">
	<div class="col-sm-4">
		<dl>
		<dt>DAY</dt>
		<dd>dzień miesiąca</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>AVG</dt>
		<dd>średnia dobowa</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>MAX</dt>
		<dd>maksimum dobowe</dd>
		</dl>
	</div>
</div>
<div class="row">
	<div class="col-sm-4">
		<dl>
		<dt>T_MAX</dt>
		<dd>godzina wystąpienia MAX</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>MIN</dt>
		<dd>minimum dobowe</dd>
		</dl>
	</div>
	<div class="col-sm-4">
		<dl>
		<dt>T_MIN</dt>
		<dd>godzina wystąpienia MIN</dd>
		</dl>
	</div>
</div>
`

class MonthlyChart	{
	
	constructor(stations_desc, mchart_area_id, mchart_height_px, 
							   gen_area_id, general_height_px,
							   typ_dchart_area_id, typ_dchart_height_px,
							   table_area_id, table_height_px,
							   table_area_legend_id)
	{	
		this.__desc = stations_desc;
		this.__monthlyParsed = null
		this.__currSerie = null
		this.__currUid = null
		this.__prev_chart_type = "CANDLE";
		
		this.__mchart_cont_id = mchart_area_id+"_mchart";
		this.__mchart_table_body_id = mchart_area_id+"_mchart_table_body";
		this.__mchar_btns_cont_id = mchart_area_id+"_mchart_btns";
		
		/* Format chart area */
		var mchartContEl = document.createElement("div");
		mchartContEl.style.height = (mchart_height_px+40).toString()+"px";
		mchartContEl.style.width = "auto";
		
		var mchartChartTypeBtnEl = document.createElement("div");
		mchartChartTypeBtnEl.className = "row";
		mchartChartTypeBtnEl.align = "right";
		mchartChartTypeBtnEl.id = this.__mchar_btns_cont_id;
		mchartContEl.append(mchartChartTypeBtnEl);
		
		var spaceEl = document.createElement("br");
		mchartContEl.append(spaceEl);
		
		var mchartChartEl = document.createElement("div");
		mchartChartEl.id = this.__mchart_cont_id;
		mchartContEl.append(mchartChartEl);
		
		/* Append to main element */
		var mchartAreaEl = document.getElementById(mchart_area_id);
		mchartAreaEl.append(mchartContEl);
		
		/* Chart buttons create */
		this._create_chart_type_btns(this);
		
		this.__unvisible_counter = 0;
		this.__mchart = this._create_mchart_template(this);
		this.__mchart.render();
		
		/* Chart of monthly general */
		this.__mchart_gen_cont_id = gen_area_id+"_mchart_general";
		var mchartGenContEl = document.createElement("div");
		mchartGenContEl.id = this.__mchart_gen_cont_id;
		mchartGenContEl.style.height = general_height_px.toString()+"px";
		var mchartGenAreaEl = document.getElementById(gen_area_id);
		mchartGenAreaEl.append(mchartGenContEl);
		
		this.__mchart_general = this._create_mchart_general_template(this);
		this.__mchart_general.render();
		
		/* Table of monthly days */
		this._create_mchart_table_template(this, table_area_id, 
											table_height_px);
		
		var tableLegendArea = document.getElementById(table_area_legend_id);
		tableLegendArea.innerHTML = mchart_table_legend;
	}
	
	_create_chart_type_btns(self) 	{
		var btnsAreaEl = document.getElementById(self.__mchar_btns_cont_id);
		
		var columnBtnEl = document.createElement("button");
		columnBtnEl.id = self.__mchar_btns_cont_id+"_COLUMN";
		columnBtnEl.type = "button";
		columnBtnEl.style = "margin-right:10px;";
		columnBtnEl.className = "btn btn-default btn-sm";
		columnBtnEl.innerHTML = "COLUMN";
		columnBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "COLUMN");
									self.__mchart.render();
								};
		
		var lineBtnEl = document.createElement("button");
		lineBtnEl.id = self.__mchar_btns_cont_id+"_LINE";
		lineBtnEl.type = "button";
		lineBtnEl.style = "margin-right:10px;";
		lineBtnEl.className = "btn btn-default btn-sm";
		lineBtnEl.innerHTML = "LINE";
		lineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "LINE");
									self.__mchart.render();
								};
								
		var areaBtnEl = document.createElement("button");
		areaBtnEl.id = self.__mchar_btns_cont_id+"_AREA";
		areaBtnEl.type = "button";
		areaBtnEl.style = "margin-right:10px;";
		areaBtnEl.className = "btn btn-default btn-sm";
		areaBtnEl.innerHTML = "AREA";
		areaBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "AREA");
									self.__mchart.render();
								};
		
		var splineBtnEl = document.createElement("button");
		splineBtnEl.id = self.__mchar_btns_cont_id+"_SPLINE";
		splineBtnEl.type = "button";
		splineBtnEl.style = "margin-right:10px;";
		splineBtnEl.className = "btn btn-default btn-sm";
		splineBtnEl.innerHTML = "SPLINE";
		splineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "SPLINE");
									self.__mchart.render();
								};
		
		var candleBtnEl = document.createElement("button");
		candleBtnEl.id = self.__mchar_btns_cont_id+"_CANDLE";
		candleBtnEl.type = "button";
		candleBtnEl.style = "margin-right:10px;";
		candleBtnEl.className = "btn btn-primary btn-sm";
		candleBtnEl.innerHTML = "CANDLE";
		candleBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "CANDLE"); 
									self.__mchart.render();
								};
		
		btnsAreaEl.append(columnBtnEl);
		btnsAreaEl.append(lineBtnEl);
		btnsAreaEl.append(areaBtnEl);
		btnsAreaEl.append(splineBtnEl);
		btnsAreaEl.append(candleBtnEl);
	}
	
	_set_chart_btn_type(self, btnType)	{
		console.log("_on_chart_btn_click: "+btnType);
		
		var prefix = self.__mchar_btns_cont_id+"_";
		var prevBtnEl = document.getElementById(prefix +
												self.__prev_chart_type);
		prevBtnEl.className = "btn btn-default btn-sm";
		var currBtnEl = document.getElementById(prefix + btnType);
		currBtnEl.className = "btn btn-primary btn-sm";
		self.__prev_chart_type = btnType;
		
		var serieUnit = serie_getUnit(
					self.__desc[self.__currUid]["serie"][self.__currSerie]);
		var mSerie=null;
		if(btnType=="CANDLE") {
			mSerie=self._set_chart_candle_type(self);
			self.__mchart.options.toolTip.content =
									"<strong>Day {x}</strong>" +
									"<br>AVG: {y[0]}"+serieUnit+
									"<br>MAX: {y[1]}"+serieUnit+
									"<br>MIN: {y[2]}"+serieUnit;
		} else if(btnType=="LINE") {
			mSerie=self._set_chart_line_type(self,self.__monthlyParsed,"line");
			self.__mchart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="SPLINE") {
			mSerie=self._set_chart_line_type(self,
										self.__monthlyParsed,"spline");
			self.__mchart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="AREA") {
			mSerie=self._set_chart_line_type(self,self.__monthlyParsed,"area");
			self.__mchart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="COLUMN") {
			mSerie=self._set_chart_line_type(self, 
										self.__monthlyParsed, "column");
			self.__mchart.options.toolTip.content = "{x}: {y}"+serieUnit;
		}
		self.__mchart.options.data = mSerie;
		self.__mchart.render();
	}
	
	_set_chart_candle_type(self) {
		console.log("_set_chart_candle_type/");
		
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		var dataSample = [];
		for(var idx in self.__monthlyParsed["avg_serie"]) {
			var sampleTemplate = {
					x: self.__monthlyParsed["avg_serie"][idx].x,
					y: [self.__monthlyParsed["avg_serie"][idx].y,
					    self.__monthlyParsed["max_serie"][idx].y,
					    self.__monthlyParsed["min_serie"][idx].y,
					    self.__monthlyParsed["avg_serie"][idx].y]
			};
			dataSample.push(sampleTemplate);
		}
		
		var serieparam = { 
				type: "candlestick",  
				dataPoints: dataSample,
				showInLegend: false,
				visible: true,
				color: serie_sampleColorTrans(serieId, "ACT")
		};
		
		console.log("/_set_chart_candle_type");
		return [serieparam];
	}
	
	_set_chart_line_type(self, parsed, type) {
		console.log("_set_chart_line_chart/");
		self.__unvisible_counter = 0;
		
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		var mSeries = self._create_mdaily_serie(self,
									parsed["avg_serie"], 
									parsed["min_serie"],
									parsed["max_serie"], serieId, type);
		
		console.log("/_set_chart_line_chart");
		return mSeries;
	}
	
	/** _create_mchart_table_template
	 * @returns
	 */
	_create_mchart_table_template(self, cont_id, height_px)
	{
		console.log("_create_mchart_table_template/");
		
		var tableCont = document.getElementById(cont_id);

		var mchartTableDivEl = document.createElement("div"); 
		mchartTableDivEl.style = "max-height:"+height_px.toString()
											  +"px; overflow-y: scroll;";

		
		var mchartTable = document.createElement("table");
		mchartTable.className = "table table-striped";
		
		var mchartTableHead = document.createElement("thead");
		mchartTableHead.innerHTML = mchart_table_head;
		mchartTable.append(mchartTableHead);
		
		var mchartTableBody = document.createElement("tbody");
		mchartTableBody.id = self.__mchart_table_body_id;
		mchartTable.append(mchartTableBody);
		
		mchartTableDivEl.append(mchartTable);
		
		tableCont.append(mchartTableDivEl);
		
		console.log("/_create_mchart_table_template");
	}
	
	/** _create_mchart_table_template
	 * @returns
	 */
	_create_mchart_daily_table(self, monthly_data, serie_unit, station_tz)
	{
		console.log("_create_mchart_daily_table/");
		
		var mtablebody = document.getElementById(self.__mchart_table_body_id);
		
		var kay_days = Object.keys(monthly_data).sort();
				
		for(var idx in kay_days)
		{
			var sampleRowEl = document.createElement("tr");
			
			var _day = kay_days[idx];
			var _day_int = parseInt(_day);
			var day_average_str = (monthly_data[_day]["f_avg_buff"]/
					 				monthly_data[_day]["i_counter"])
					 				.toFixed(1).toString();
					 			
			var day_min_str = monthly_data[_day]["f_min"].toString()
			var day_max_str = monthly_data[_day]["f_max"].toString()
			
			var min_hm = moment(monthly_data[_day]["i_min_ts"]*1000)
											.tz(station_tz).format("HH:mm");
			var max_hm = moment(monthly_data[_day]["i_max_ts"]*1000)
											.tz(station_tz).format("HH:mm");
			
			var dayEl = document.createElement("td");
			dayEl.innerHTML = _day_int.toString();
			dayEl.style = "text-align: center;";
			var avgEl = document.createElement("td");
			avgEl.innerHTML = day_average_str+serie_unit;
			avgEl.style = "text-align: center;";
			var maxEl = document.createElement("td");
			maxEl.innerHTML = day_max_str+serie_unit;
			maxEl.style = "text-align: center;";
			var minEl = document.createElement("td");
			minEl.innerHTML = day_min_str+serie_unit;
			minEl.style = "text-align: center;";
			var minTsEl = document.createElement("td");
			minTsEl.innerHTML = min_hm;
			minTsEl.style = "text-align: center;";
			var maxTsEl = document.createElement("td");
			maxTsEl.innerHTML = max_hm;
			maxTsEl.style = "text-align: center;";
			
			sampleRowEl.append(dayEl);
			sampleRowEl.append(avgEl);
			sampleRowEl.append(maxEl);
			sampleRowEl.append(maxTsEl);
			sampleRowEl.append(minEl);
			sampleRowEl.append(minTsEl);
			mtablebody.append(sampleRowEl);
		}
		console.log("/_create_mchart_daily_table");
	}
	
	/** function _create_mchart_general_serie
	 * month_avg
	 * month_max
	 * month_min
	 * station_tz
	 * serie_id
	 * @returns: general properties table
	 */
	_create_mchart_general_serie(self, month_avg, month_max, month_min, 
												  station_tz, serie_id)
	{
		console.log("month_avg " + JSON.stringify(month_avg));
		console.log("month_max " + JSON.stringify(month_max));
		console.log("month_min " + JSON.stringify(month_min));
		console.log("station_tz " + station_tz);
		console.log("serie_id " + serie_id);
		
		var t_min = moment(month_min["ts"])
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
		var t_max = moment(month_max["ts"])
									.tz(station_tz).format("YYYY-MM-DD HH:mm");
		
		var monthly_general_serie = 
		[{			
			type: "bar",
			indexLabelFontSize: 14,
			dataPoints:	[{
				y: month_min["value"], 
				label: "MIN "+t_min, 
				indexLabel: month_min["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "MIN")
			},
			{
				y: month_avg["value"], 
				label: "AVG", 
				indexLabel: month_avg["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "AVG")
			},
			{	
				y: month_max["value"], 
				label: "MAX "+t_max, 
				indexLabel: month_max["value"].toString(),
				color: serie_sampleColorTrans(serie_id, "MAX")
			}]
		}];
		
		return monthly_general_serie;
	}
	
	/** function _create_mchart_general_template
	 * 
	 */
	_create_mchart_general_template(self)
	{
		var chart = new CanvasJS.Chart(this.__mchart_gen_cont_id,
	    {
			animationEnabled: true,
			title:
			{
				fontSize: 16
			},
			backgroundColor: null,
			axisY: 
			{
				titleFontSize: 16,
				labelFontSize: 12
			},
			axisX: 
			{
				titleFontSize: 16,
				labelFontSize: 12
			},
			theme: "theme1",
			backgroundColor: null,
			data: [],
			toolTip: {},
	    });
		
		return chart;
	}
	
	/** function _parse_mdata
	 * monthly_data
	 * serie_id
	 * @returns: parsed monthly data
	 */	
	_parse_mdata(self, monthly_data, serie_id)
	{
		var month_buff_f = 0.0;
		var month_buff_counter = 0;
		var month_min_f = 999999.0;
		var month_max_f = -999999.0;
		var month_min_ts = 0;
		var month_max_ts = 0;
		
		var avg_serie = [];
		var min_serie = [];
		var max_serie = [];
		
		var kay_days = Object.keys(monthly_data).sort();
		
		for(var idx in kay_days)
		{
			var _day = kay_days[idx];
			var _day_int = parseInt(_day);
			var day_average_f = parseFloat(
					(monthly_data[_day]["f_avg_buff"]/
					 monthly_data[_day]["i_counter"]).toFixed(1));				
			
			month_buff_f += day_average_f
			month_buff_counter += 1;
			
			if(month_min_f > monthly_data[_day]["f_min"])
			{
				month_min_f = monthly_data[_day]["f_min"];
				month_min_ts = monthly_data[_day]["i_min_ts"];
			}
			
			if(month_max_f < monthly_data[_day]["f_max"])
			{
				month_max_f = monthly_data[_day]["f_max"];
				month_max_ts = monthly_data[_day]["i_max_ts"];
			}
			
			var sampleTemplate = {x: _day_int, y: day_average_f};
			avg_serie.push(sampleTemplate);
			
			var sampleTemplate = {
					x: _day_int, 
					y: parseFloat(monthly_data[_day]["f_max"].toFixed(1))
				};
			max_serie.push(sampleTemplate);
			
			var sampleTemplate = {
					x: _day_int, 
					y: parseFloat(monthly_data[_day]["f_min"].toFixed(1))
				};
			min_serie.push(sampleTemplate);
		}
		
		month_min_ts *= 1000;
		month_max_ts *= 1000;
		var m_min = {"value": parseFloat(month_min_f.toFixed(1)), 
						"ts": month_min_ts};
		var m_avg = {"value": parseFloat((month_buff_f/month_buff_counter)
															.toFixed(1))};
		var m_max = {"value": parseFloat(month_max_f.toFixed(1)), 
						"ts": month_max_ts};
		
		var result = {
				"avg_serie": avg_serie, "max_serie": max_serie,
				"min_serie": min_serie, "m_min": m_min, "m_max": m_max,
				"m_avg": m_avg
			};
		
		return result;
	}
	
	/** function _create_mdaily_serie
	 * avg_sample
	 * min_sample
	 * max_sample
	 * @returns: days serie properties table
	 */
	_create_mdaily_serie(self,avg_sample,min_sample,max_sample,serie_id,type)
	{
		var avg_serie = { 
			type: type,  
			dataPoints: avg_sample,
			showInLegend: true,
			name: "AVG",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "AVG")
		};

		var max_serie = { 
			type: type,  
			dataPoints: max_sample,
			showInLegend: true,
			name: "MAX",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "MAX")
		};
		
		var min_serie = { 
			type: type,  
			dataPoints: min_sample,
			showInLegend: true,
			name: "MIN",
			visible: true,
			color: serie_sampleColorTrans(serie_id, "MIN")
		};

		return [max_serie, avg_serie, min_serie];
	}
	
	/** function _create_dchart_template
	 * 
	 */
	_create_mchart_template(self)
	{
		var chart = new CanvasJS.Chart(self.__mchart_cont_id,
	    {
			animationEnabled: true,
			theme: "theme1",
			title:
			{
				fontSize: 16
			},
			zoomEnabled: true,
			backgroundColor: null,
			axisY: {
				titleFontSize: 16,
				labelFontSize: 12,
				stripLines:[]
			},
			axisX: {
				titleFontSize: 16,
				labelFontSize: 12,
				interval: 1
			},
			legend: {
				cursor: "pointer",
				fontSize: 16,
				itemclick: function(e)	{
					if (typeof(e.dataSeries.visible) === "undefined" 
						|| e.dataSeries.visible) {
						
						if(self.__unvisible_counter < 2)	{
							e.dataSeries.visible = false;
							self.__unvisible_counter += 1;
						}
					}
					else {
						e.dataSeries.visible = true;
						self.__unvisible_counter -= 1;
					}
					
					self.__mchart.render();
				}
			},
			toolTip: {},
			data: []
	    });
		
		return chart;
	}
	
	/** function redraw
	 * uid: station string uid (format: DEVICENAME_UID or just UID)
	 * serie: "Temperature", "Humidity"
	 * dt_str: "YYYY-MM"
	 */
	redraw(uid, serie, dt_str)
	{
		console.log("redraw("+uid+", "+serie+", "+dt_str+")");
		
		// Extract short UID from device_name_uid format (e.g., "RODOS_110020FF0001" -> "110020FF0001")
		var shortUid = uid.includes("_") ? uid.split("_").slice(1).join("_") : uid;
		
		// Convert serie name to serie ID for API call
		var serieId = this.__desc[shortUid]["serie"][serie];
		
		var self = this;
		self.__unvisible_counter = 0;
		var param = JSON.stringify({
			"uid": uid, 
			"serie": serieId, 
			"date": dt_str
		});
		
		$.ajax({
			type: "GET",
			url: "/restq/station/serie/monthly/"+param,
			success: function(data) {
//				console.log("monthlyData " + data);
				
				var monthlyData = data;
				
				self.__mchart = self._create_mchart_template(self);
				self.__mchart_general = 
								self._create_mchart_general_template(self);
				
				var serieId = self.__desc[shortUid]["serie"][serie];
				var stationTz = self.__desc[shortUid]["timezone"];
        		var serieUnit = serie_getUnit(self.__desc[shortUid]["serie"][serie]);
        		self.__currSerie = serie;
        		self.__currUid = shortUid;
        		
        		/* Monthly days chart create */
        		if(serie == "Humidity") {
        			self.__mchart.options.axisY.maximum = 102; 
        		}
        		
        		var chartTitle = dt_str + " " + serie.toUpperCase();
        		self.__mchart.options.title.text = chartTitle;
        		self.__mchart.options.axisY.title = serie;
        		self.__mchart.options.axisY.labelFormatter = function(e) 
        							{
        								return e.value.toFixed(1)+serieUnit;
        							};
        		self.__mchart.options.axisY.stripLines = 
        				serie_getLabelColors(self.__desc[shortUid]["serie"][serie]);
        		
        		var mchartSerie = self._parse_mdata(self,monthlyData,serieId);
        		self.__monthlyParsed = mchartSerie;
        		
        		self._set_chart_btn_type(self, "CANDLE");
        		
        		/* Monthly general chart create */
        		if(serie == "Humidity") {
        			self.__mchart_general.options.axisY.maximum = 102; 
        		}
        		self.__mchart_general.options.title.text = 
														dt_str + " STATISTICS";
				self.__mchart_general.options.axisY.title = serie;
				self.__mchart_general.options.axisY.labelFormatter = 
									function(e) 
									{
										return e.value.toFixed(1)+serieUnit;
									};
				var generalSample = self._create_mchart_general_serie(self, 
														mchartSerie["m_avg"],
														mchartSerie["m_max"],
														mchartSerie["m_min"],
														stationTz, serieId);
				self.__mchart_general.options.data = generalSample;
				
				var serieUnit = serie_getUnit(
									self.__desc[shortUid]["serie"][serie]);
				self.__mchart_general.options.toolTip.content = 
									"{label}: {y}"+serieUnit;
				self.__mchart_general.render();
				
				self._create_mchart_daily_table(self, monthlyData, serieUnit,
													stationTz);
			}
		});
	}
}

/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
