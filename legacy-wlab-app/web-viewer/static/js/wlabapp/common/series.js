/* 
	WeatherLab serie.js
	$Rev: 255 $
	$Author: kkuras $
	$Date: 2018-03-17 21:02:31 +0100 (sob) $
*/

/*
 	-30: color: "rgb(91,192,222)"
 	-20: color: "rgb(67,77,186)"
 	-10: color: "rgb(2,169,245)"
 	  0: color: "rgb(0,149,136)"
 	 10: color: "rgb(40,154,39)"
 	 20: color: "rgb(250,155,8)"
 	 30: color: "rgb(254,87,34)"
 */

var seriesTypes = {1:"°C", 2:"%"}

/** function serie_sampleNameTrans
 * sample_name - ACT,AVG,MIN,MAX
 */
var sampleNameTrans = {
	"ACT": "f_act", 
	"MIN": "f_min", 
	"MAX": "f_max", 
	"AVG": "f_avg"
};

function serie_sampleNameTrans(sample_name)
{
	return sampleNameTrans[sample_name];
}

/** function serie_sampleColorTrans
 * sample_name - ACT,AVG,MIN,MAX
 * serieid - seriesTypes 
 */
//var tempSampleColorTrans = {
//	"ACT": "rgb(38,146,135)",
//	"MIN": "rgb(91,192,222)",
//	"MAX": "rgb(217,83,79)",
//	"AVG": "rgb(96,185,96)"
//}

var tempSampleColorTrans = {
	"ACT": "#669999",
	"MIN": "#006699",
	"MAX": "#FF6600",
	"AVG": "#009933"
}

var humiditySampleColorTrans = {
	"AVG": "#009933",
	"MAX": "#006699",
	"MIN": "#FF6600",
	"ACT": "#669999"
}

function serie_sampleColorTrans(serieid, sample_name) {
	if(serieid==1) {
		return tempSampleColorTrans[sample_name];
	} else if(serieid==2) {
		return humiditySampleColorTrans[sample_name];
	} else {
		return {};
	}
}


/** function serie_getLabelColors
 * serieid - seriesTypes 
 */
var tempSerieColorLabel = [
{
	value: 0, 
	lable: "0°C", 
	labelPlacement:"inside", 
	thickness: 6,
	color: "rgb(38,146,135)"
},
{
	value: 15, 
	label: "15°C", 
	labelPlacement:"inside", 
	color: "rgb(250,155,8)",
	lineDashType: "dot"
},
{
	value: -15, 
	label: "-15°C", 
	labelPlacement:"inside",
	color: "rgb(67,77,186)", 
	lineDashType: "dot"
},
{
	value: 5, 
	label: "5°C", 
	labelPlacement: "inside",
	color: "rgb(40,154,39)", 
	lineDashType: "dot"
},
{
	value: -5, 
	label: "-5°C", 
	labelPlacement: "inside",
	color: "rgb(2,169,245)", 
	lineDashType: "dot"
}];

function serie_getLabelColors(serieid) {
	if(serieid==1) {
		return tempSerieColorLabel;
	} else {
		return [];
	}
}

function serie_getUnit(serieid) {
	var unit="";
	if(serieid in seriesTypes) {
		unit = seriesTypes[serieid];
	} else {
		console.error("unknown serie type " + serieid)
	}
	
	return unit
}

/* 	-------------------------------------------------------------------------/
	end of file
	------------------------------------------------------------------------*/
