/* 
	WeatherLab dchart.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/

var dchart_cont_base = 
`
<div id="tpl_id" style='height: tpl_hpxpx'></div>
`;

var dchart_table_head = 
`
<tr>
	<th style="text-align: center;">TS</th>
	<th style="text-align: center;">ACT</th>
    <th style="text-align: center;">AVG</th>
    <th style="text-align: center;">MAX</th>
    <th style="text-align: center;">T_MAX</th>
    <th style="text-align: center;">MIN</th>
    <th style="text-align: center;">T_MIN</th>
</tr>
`

var dchart_table_legend = 
`
	<div class="row">
		<div class="col-sm-3">
			<dl>
			<dt>TS</dt>
			<dd>czas pomiaru</dd>
			</dl>
		</div>
		<div class="col-sm-3">
			<dl>
			<dt>ACT</dt>
			<dd>wartość w czasie TS</dd>
			</dl>
		</div>
		<div class="col-sm-3">
			<dl>
			<dt>AVG</dt>
			<dd>średnia od poprzedniego pomiaru</dd>
			</dl>
		</div>
		<div class="col-sm-3">
			<dl>
			<dt>MAX</dt>
			<dd>maksimum od poprzedniego pomiaru</dd>
			</dl>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-3">
			<dl>
			<dt>T_MAX</dt>
			<dd>godzina wystąpienia MAX</dd>
			</dl>
		</div>
		<div class="col-sm-3">
			<dl>
			<dt>MIN</dt>
			<dd>minimum od poprzedniego pomiaru</dd>
			</dl>
		</div>
		<div class="col-sm-3">
			<dl>
			<dt>T_MIN</dt>
			<dd>godzina wystąpienia MIN</dd>
			</dl>
		</div>
		<div class="col-sm-3">
		</div>
	</div>
`;
	
class DailyChart	{
	
	constructor(stations_desc, work_area_id, height_px, 
							   gen_area_id, general_height_px,
							   table_area_id, table_height_px,
							   table_legend_area_id)
	{
		this.__desc = stations_desc;
		this.__dailyData = null;
		this.__currSerie = null;
		this.__currUid = null;
		
		this.__dchar_cont_id = work_area_id+"_dchart";
		this.__dchar_btns_cont_id = work_area_id+"_dchart_btns";
		this.__prev_chart_type = "CANDLE";
		
		var dchartContEl = document.createElement("div");
		dchartContEl.style.height = (height_px+40).toString()+"px";
		dchartContEl.style.width = "auto";
		
		var dchartChartTypeBtnEl = document.createElement("div");
		dchartChartTypeBtnEl.className = "row";
		dchartChartTypeBtnEl.align = "right";
		dchartChartTypeBtnEl.id = this.__dchar_btns_cont_id;
		dchartContEl.append(dchartChartTypeBtnEl);
		
		var spaceEl = document.createElement("br");
		dchartContEl.append(spaceEl);
		
		var dchartChartEl = document.createElement("div");
		dchartChartEl.id = this.__dchar_cont_id;
		dchartContEl.append(dchartChartEl);
		
		var workAreaEl = document.getElementById(work_area_id);
		workAreaEl.append(dchartContEl);		
		
		/* Chart buttons create */
		this._create_chart_type_btns(this);
		
		/* At start only one serie is visible */
		this.__unvisible_counter = 3;
		
		if(gen_area_id!=null && general_height_px!=null)
		{
			this.__dchar_general_cont_id = gen_area_id+"_dchart_general";
						
			var dchartGeneralContEl = document.createElement("div");
			dchartGeneralContEl.id = this.__dchar_general_cont_id;
			
			dchartGeneralContEl.style.height = 
											general_height_px.toString()+"px";
			
			var generalAreaEl = document.getElementById(gen_area_id);
			generalAreaEl.append(dchartGeneralContEl);
			
			this.__draw_general = true;
			this.__chart_general = this._create_dchart_general_template();
			this.__chart_general.render();
		}
		else
		{
			this.__draw_general = false;
		}
		
		if(table_area_id!=null && table_height_px!=null)
		{
			this.__dchar_table_body_id = table_area_id+"_dchart_table";
			this._create_table_template(this, table_area_id, table_height_px);
			this.__draw_table = true;
		}
		else
		{
			this.__draw_table = false;
		}
		
		this.__chart = this._create_dchart_template(this);
		this.__chart.render();
		
		if(table_legend_area_id!=null)
		{
			var tableLegendArea = document.getElementById(table_legend_area_id);
			tableLegendArea.innerHTML = dchart_table_legend;			
		}
	}
	
	_create_chart_type_btns(self) 	{
		var btnsAreaEl = document.getElementById(self.__dchar_btns_cont_id);
		
		var lineBtnEl = document.createElement("button");
		lineBtnEl.id = self.__dchar_btns_cont_id+"_LINE";
		lineBtnEl.type = "button";
		lineBtnEl.style = "margin-right:10px;";
		lineBtnEl.className = "btn btn-default btn-sm";
		lineBtnEl.innerHTML = "LINE";
		lineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "LINE");
									self.__chart.render();
								};
		
		var areaBtnEl = document.createElement("button");
		areaBtnEl.id = self.__dchar_btns_cont_id+"_AREA";
		areaBtnEl.type = "button";
		areaBtnEl.style = "margin-right:10px;";
		areaBtnEl.className = "btn btn-default btn-sm";
		areaBtnEl.innerHTML = "AREA";
		areaBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "AREA");
									self.__chart.render();
								};
		
		var splineBtnEl = document.createElement("button");
		splineBtnEl.id = self.__dchar_btns_cont_id+"_SPLINE";
		splineBtnEl.type = "button";
		splineBtnEl.style = "margin-right:10px;";
		splineBtnEl.className = "btn btn-default btn-sm";
		splineBtnEl.innerHTML = "SPLINE";
		splineBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "SPLINE");
									self.__chart.render();
								};
		
		var candleBtnEl = document.createElement("button");
		candleBtnEl.id = self.__dchar_btns_cont_id+"_CANDLE";
		candleBtnEl.type = "button";
		candleBtnEl.style = "margin-right:10px;";
		candleBtnEl.className = "btn btn-primary btn-sm";
		candleBtnEl.innerHTML = "CANDLE";
		candleBtnEl.onclick = function() { 
									self._set_chart_btn_type(self, "CANDLE"); 
									self.__chart.render();
								};
		
		btnsAreaEl.append(lineBtnEl);
		btnsAreaEl.append(areaBtnEl);
		btnsAreaEl.append(splineBtnEl);
		btnsAreaEl.append(candleBtnEl);
	}
	
	_set_chart_btn_type(self, btnType)	{
		console.log("_on_chart_btn_click: "+btnType);
		
		var prefix = self.__dchar_btns_cont_id+"_";
		var prevBtnEl = document.getElementById(prefix +
												self.__prev_chart_type);
		prevBtnEl.className = "btn btn-default btn-sm";
		var currBtnEl = document.getElementById(prefix + btnType);
		currBtnEl.className = "btn btn-primary btn-sm";
		self.__prev_chart_type = btnType;
		
		var serieUnit = serie_getUnit(
					self.__desc[self.__currUid]["serie"][self.__currSerie]);
		
		if(btnType=="CANDLE") {
			var candle_serie = self._create_candle_serie_data(self);
			self.__chart.options.toolTip.content =
								"<strong>{x}</strong>" +
								"<br>AVG: {y[0]}"+serieUnit+
								"<br>MAX: {y[1]}"+serieUnit+
								"<br>MIN: {y[2]}"+serieUnit;
			self.__chart.options.data = [candle_serie];
		} else if(btnType=="SPLINE") {
			self._set_chart_line_type(self, "spline");
			self.__chart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="AREA") {
			self._set_chart_line_type(self, "area");
			self.__chart.options.toolTip.content = "{x}: {y}"+serieUnit;
		} else if(btnType=="LINE") {
			self._set_chart_line_type(self, "line");
			self.__chart.options.toolTip.content = "{x}: {y}"+serieUnit;
		}
	}
	
	_set_chart_line_type(self, type) {
		console.log("_set_chart_line_chart/");
		this.__unvisible_counter = 3;
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		
		var actDataSample = self._create_serie_data(
					self, self.__dailyData, "ACT", true, serieId, type);

		var avgDataSample = self._create_serie_data(
					self, self.__dailyData, "AVG", false, serieId, type);
		
		var minDataSample = self._create_serie_data(
					self, self.__dailyData, "MIN", false, serieId, type);
		
		var maxDataSample = self._create_serie_data(
					self, self.__dailyData, "MAX", false, serieId, type);
		
		self.__chart.options.data = [actDataSample, maxDataSample, 
		                             avgDataSample, minDataSample];
		
		console.log("/_set_chart_line_chart");
	}
	
	/** function _create_table_template
	 * cont_id - container to draw table
	 * height_px - max height of table
	 */
	_create_table_template(self, cont_id, height_px)
	{
		console.log("_create_table_template/");
		
		var tableCont = document.getElementById(cont_id);

		var dchartTableDivEl = document.createElement("div"); 
		dchartTableDivEl.style = "max-height:"+height_px.toString()
											  +"px; overflow-y: scroll;";
		
		var dchartTable = document.createElement("table");
		dchartTable.className = "table table-striped";

		dchartTableDivEl.append(dchartTable);
		
		var dchartTableHead = document.createElement("thead");
		dchartTableHead.innerHTML = dchart_table_head;
		dchartTable.append(dchartTableHead);
		
		var dchartTableBody = document.createElement("tbody");
		dchartTableBody.id = self.__dchar_table_body_id;
		
		dchartTable.append(dchartTableBody);
		
		tableCont.append(dchartTableDivEl);
		
		console.log("/_create_table_template");
	}
	
	/** function _create_table_body
	 * daily_data - daily data from datbase
	 * station_tz - timezone
	 * serie_id - serie id 0, 1
	 */
	_create_table_body(self, daily_data, station_tz, serie_id)
	{
		
		var tablebody = document.getElementById(self.__dchar_table_body_id);
		
		for(var ts in daily_data)
		{	
			if(ts != "general")
			{	
				var sampleRowEl = document.createElement("tr");
				var hm = moment(parseInt(ts)*1000).tz(station_tz)
												  .format("HH:mm");

				var act = daily_data[ts]["f_act"].toFixed(1).toString();
				var avg = daily_data[ts]["f_avg"].toFixed(1).toString();
				var min = daily_data[ts]["f_min"].toFixed(1).toString();
				var max = daily_data[ts]["f_max"].toFixed(1).toString();
				
				var t_min = moment(daily_data[ts]["i_min_ts"]*1000)
														.tz(station_tz)
														.format("HH:mm");
				
				var t_max = moment(daily_data[ts]["i_max_ts"]*1000)
														.tz(station_tz)
														.format("HH:mm");
				var serieUnit = serie_getUnit(serie_id);
				
				var tsEl = document.createElement("td");
				tsEl.innerHTML = hm;
				tsEl.style = "text-align: center;";
				var actEl = document.createElement("td");
				actEl.innerHTML = act+serieUnit;
				actEl.style = "text-align: center;";
				var avgEl = document.createElement("td");
				avgEl.innerHTML = avg+serieUnit;
				avgEl.style = "text-align: center;";
				var minEl = document.createElement("td");
				minEl.innerHTML = min+serieUnit;
				minEl.style = "text-align: center;";
				var maxEl = document.createElement("td");
				maxEl.innerHTML = max+serieUnit;
				maxEl.style = "text-align: center;";
				var tMaxEl = document.createElement("td");
				tMaxEl.innerHTML = t_max;
				tMaxEl.style = "text-align: center;";
				var tMinEl = document.createElement("td");
				tMinEl.innerHTML = t_min;
				tMinEl.style = "text-align: center;";
				
				sampleRowEl.append(tsEl);
				sampleRowEl.append(actEl);
				sampleRowEl.append(avgEl);
				sampleRowEl.append(maxEl);
				sampleRowEl.append(tMaxEl);
				sampleRowEl.append(minEl);
				sampleRowEl.append(tMinEl);
				tablebody.append(sampleRowEl);
			}
		}
	}
	
	_create_candle_serie_data(self) {
		console.log("_create_candle_serie_data/");
		
		var serieId = self.__desc[self.__currUid]["serie"][self.__currSerie];
		var dataSample = [];
		for(var ts in self.__dailyData) {	
			if(ts != "general") {	
				var dateTime = new Date(parseInt(ts*1000));
				var sampleTemplate = {
					x: dateTime,
					y: [self.__dailyData[ts]["f_avg"],
					    self.__dailyData[ts]["f_max"],
					    self.__dailyData[ts]["f_min"],
					    self.__dailyData[ts]["f_avg"]]
				};
				dataSample.push(sampleTemplate);
			}
		}

		var serieparam = { 
			type: "candlestick",  
			dataPoints: dataSample,
			showInLegend: false,
			visible: true,
			color: serie_sampleColorTrans(serieId, "ACT")
		};
		console.log("/_create_candle_serie_data");
		return serieparam;
	}
	
	/** function _create_serie_data
	 * data - daily data from datbase
	 * sample_name - ACT,MIN,MAX,AVG
	 * start_visible - true, false
	 * serie_id - serie id 0, 1
	 */
	_create_serie_data(self, data, sample_name, start_visible, serie_id, type)
	{
		var nameTrans = serie_sampleNameTrans(sample_name);
		var dataSample = [];
		
		for(var ts in data)
		{	
			if(ts != "general")
			{	
				var dateTime = new Date(parseInt(ts*1000));
				var sampleTemplate = {
					x: dateTime,
					y: data[ts][nameTrans]
				};
				dataSample.push(sampleTemplate);
			}
		}
		
		var sampleColor = serie_sampleColorTrans(serie_id, sample_name)
		var serieparam = { 
			type: type,  
			dataPoints: dataSample,
			showInLegend: true,
			name: sample_name,
			visible: start_visible,
			color: sampleColor
		};
		
		return serieparam;
	}
	
	/** _create_dchart_general_template
	 * 
	 */
	_create_dchart_general_template()
	{
		var chart = new CanvasJS.Chart(this.__dchar_general_cont_id,
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
				labelFontSize: 12,
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
	
	/** function _create_general_serie_data
	 * station_tz - station timezone
	 * daily_general - general daily data dict
	 * serie_id - serie id 0,1
	 */
	_create_general_serie_data(station_tz, daily_general, serie_id)
	{		
		var t_min = moment(daily_general["i_min_ts"]*1000)
											.tz(station_tz).format("HH:mm");
		var t_max = moment(daily_general["i_max_ts"]*1000)
											.tz(station_tz).format("HH:mm");
		
		var _min = parseFloat(daily_general["f_min"].toFixed(1));
		var _max = parseFloat(daily_general["f_max"].toFixed(1));
		var _avg = parseFloat((daily_general["f_avg_buff"]/
						   			daily_general["i_counter"]).toFixed(1));
		
 	   	var general_serie_data = 
        [{			
        	type: "bar",
        	indexLabelFontSize: 14,
   		   	dataPoints:[{
		    	    	   y: _min, 
		    	    	   label: "MIN "+t_min, 
		    	    	   indexLabel: _min.toString(),
		    	    	   color: serie_sampleColorTrans(serie_id, "MIN")
		    	       	},
   		   	           	{
		    	    	   y: _avg, 
		    	    	   label: "AVG", 
		    	    	   indexLabel: _avg.toString(),
		    	    	   color: serie_sampleColorTrans(serie_id, "AVG")
   		   	           	},
   		   	           	{	
		    	    	   y: _max, 
		    	    	   label: "MAX "+t_max, 
		    	    	   indexLabel: _max.toString(),
		    	    	   color: serie_sampleColorTrans(serie_id, "MAX")
   		   	           	}]
 		}];
 	   	
 	   	return general_serie_data;
	}
	
	/** function _create_dchart_template
	 * 
	 */
	_create_dchart_template(self)
	{
		var chart = new CanvasJS.Chart(self.__dchar_cont_id,
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
				stripLines:[],
			},
			axisX: {
				titleFontSize: 16,
				labelFontSize: 12,
				valueFormatString: "HH:mm",
			},
			legend: {
				cursor: "pointer",
				fontSize: 16,
				itemclick: function(e)	{
					if (typeof(e.dataSeries.visible) === "undefined" 
						|| e.dataSeries.visible) {
						
						if(self.__unvisible_counter < 3)	{
							e.dataSeries.visible = false;
							self.__unvisible_counter += 1;
						}
					}
					else {
						e.dataSeries.visible = true;
						self.__unvisible_counter -= 1;
					}
					
					self.__chart.render();
				}
			},
			toolTip: {},
			data: []
	    });
		
		return chart;
	}

	/** function redraw
	 * uid: station string uid
	 * serie: "Temperature", "Humidity"
	 * dt_str: "YYYY-MM-DD"
	 */
	redraw(uid, serie, dt_str)
	{
		/* At start only one serie is visible */
		this.__unvisible_counter = 3;
		this.__currSerie = serie;
		this.__currUid = uid;
		
		var self = this;
		var param = JSON.stringify({
			"uid": uid, 
			"serie": serie, 
			"date": dt_str
		});
		
		console.log("Daily chart redraw, now " + param);
		
    	$.ajax({
    		type: "GET",
    		url: "/restq/station/serie/daily/"+param,
    		success: function(data)
    		{
                var dailyData = data;
                self.__dailyData = dailyData;
                
                self.__chart = self._create_dchart_template(self);
                
                self._set_chart_btn_type(self, "CANDLE");
        		
        		var serieId=self.__desc[uid]["serie"][serie];
        		var serieUnit=serie_getUnit(self.__desc[uid]["serie"][serie]);
        		
        		var chartTitle = dt_str + " " + serie.toUpperCase();
        		self.__chart.options.title.text = chartTitle;
        		self.__chart.options.axisY.title = serie;
        		
        		if(serie == "Humidity") {
        			self.__chart.options.axisY.maximum = 102; 
        		}
        			
        		self.__chart.options.axisY.labelFormatter = function(e) 
        							{
        								return e.value.toFixed(1)+serieUnit;
        							};
        							
        		self.__chart.options.axisY.stripLines = 
        				serie_getLabelColors(self.__desc[uid]["serie"][serie]);
        		
        		if(self.__draw_general == true) {
        			self.__chart_general = 
        								self._create_dchart_general_template();
        			
        			var generalSample = self._create_general_serie_data(
        									self.__desc[uid]["timezone"],
        									dailyData["general"], 
        									serieId);
        			
            		if(serie == "Humidity") {
            			self.__chart_general.options.axisY.maximum = 102; 
            		}
            		
        			self.__chart_general.options.title.text = 
        												dt_str + " STATISTICS";
        			self.__chart_general.options.axisY.title = serie;
        			
            		self.__chart_general.options.axisY.labelFormatter = 
            						function(e) 
									{
										return e.value.toFixed(1)+serieUnit;
									};
					self.__chart_general.options.data = generalSample;
					
					var serieUnit = serie_getUnit(
										self.__desc[uid]["serie"][serie]);
					self.__chart_general.options.toolTip.content = 
										"{label}: {y}"+serieUnit;
					
					console.log("__chart_general.render()");
					self.__chart_general.render();
    			}
        		
        		if(self.__draw_table == true) {
        			self._create_table_body(self, dailyData, 
        										  self.__desc[uid]["timezone"],
        										  serieId);
        		}
        		
        		self.__chart.render();
            }
    	});
	}
}

/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
