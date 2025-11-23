/* 
	WeatherLab info.js
	$Rev: 248 $
	$Author: kkuras $
	$Date: 2018-02-08 21:34:54 +0100 (czw) $
*/

var info_page_base = 
`<div class="panel panel-primary">
	<div class="panel-heading text-center">
	<dt>INFORMACJE</dt>
	</div>
	<div class="panel-body">
	<div class="well">
	<div class="container-fluid">
	    <div class="col-sm-2">
	    </div>
	    <div class="col-sm-6">
	    	<h5 align="center">AKTUALNE WYDANIE</h5>
		    <div class="col-sm-4">
			    <p align="right">WERSJA</p>
			    <p align="right">RELEASE DATE</p>
		    </div>
		    <div class="col-sm-8">
			    <p align="left" id="info_verRow"></p>
			    <p align="left" id="info_dateRow"></p>
		    </div>
	    </div>
	    <div class="col-sm-4">
	    </div>
	</div>
	</div>
</div>`;

function _info_showVersion()
{
	console.log("_info_showVersion/");
	
	$.ajax({
		type: "GET",
		url: "/globals/version",
		success: function(data)
		{
			dataParsed = data;
            var verRowEl = document.getElementById("info_verRow");       
			verRowEl.innerHTML = dataParsed["version"];
            var dateRowEl = document.getElementById("info_dateRow");       
			dateRowEl.innerHTML = dataParsed["date"];
            console.log("/_info_showVersion");
        }
	});
}

function info_createPage(workArea)
{
	console.log("info_createPage/ - " + workArea);

	var mainBodyEl = document.getElementById(workArea);
	mainBodyEl.innerHTML = info_page_base;
	_info_showVersion();
	console.log("/info_createPage");
}


/* 	------------------------------------------------------------------------- /
	end of file
	------------------------------------------------------------------------ */
