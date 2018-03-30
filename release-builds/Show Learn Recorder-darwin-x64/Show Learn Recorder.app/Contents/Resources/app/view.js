var $ = require('jquery');
var popper = require('popper.js');
var bootstrap = require('bootstrap');
var func = require('./main_func');
const {dialog} = require('electron').remote
const electron = require('electron');
var osc = require('node-osc');
var ip = require('ip');
var remote = require('electron').remote

var resultFilename = remote.getGlobal('userDataPath') + "/" + "result.json"

var cueList = []
var showInfo = []
var listInfo = []
var currentList;
var allCuelists;
var toggleSwitch = 0
var runTimer;
var startTime = Date.now();
var cueCount = 0;

// Set ui states on startup
$(".colSettings .card-body").collapse("show");
$(".btnStartServer").prop( "disabled", true );
$(".btnStopServer").prop( "disabled", true );
$(".inpCueLists").prop( "disabled", true );
updateStatus("statServer", "Gestopt", "warning");
updateStatus("statIpadress", ip.address(), "dark");

// Card collapse icon init
$(".collapse").each(function(){
	$(this).parent().find(".card-header").append("<div class=\"collapseArrow\"><i class=\"mdi mdi-chevron-left\"></i></div>");
	console.log("asdasdsa");
})

// Card collapse toggle
$(".card .card-header").on("click", function(){
	cardCollapse(this, "toggle");
})

// On filedialog Open: load and parse xml file
$(".btnHogExportFileDialog").on("click", function(){
	dialog.showOpenDialog({properties: ['openFile']}, function (fileNames) {
		if(fileNames !== undefined){
			// File opened
			$(".inpHogExportFile").val(fileNames[0]);

			// Parse input xml file
			func.parseHogExport(fileNames[0], function(err, result){
				// TODO: controle inbouwen of onderstaande wel bestaan in xml bestand en geef melding
				
				if(err === null){

					if(result.Hog.Show[0].Cuelist !== undefined){
						allCuelists = result.Hog.Show[0].Cuelist;
						showInfo = result.Hog.Show[0]["$"]
					
						// Fill current showname
						$(".currentShow").val(showInfo.name);
						updateStatus("statCurrShow", showInfo.name, "dark")

						// Fill dropdown with available lists
						$(".inpCueLists").html("<option value=\"false\">Kies een Cuelist</option>");
						for(key in allCuelists){
							$(".inpCueLists").append("<option value=\"" + key + "\">" + allCuelists[key]["$"].number + ": " + allCuelists[key]["$"].name + "</option>");
						}

						// Enable dropdown
						$(".inpCueLists").prop( "disabled", false );

					}else{
						dialog.showMessageBox({
							type: "error",
							buttons:["Ok"],
							message: "Onjuist Hog Export XML bestand",
							detail: "Weet je zeker dat je de juiste export hebt gemaakt in de Hog?"
						});
					}
				}else{
					dialog.showMessageBox({
						type: "error",
						buttons:["Ok"],
						message: "Dit is geen XML bestand",
						detail: "Weet je zeker dat je de juiste export hebt gemaakt in de Hog?"
					});
				}
			})
		}
  });
})

// On dropdown select: get current cuelist
$(".inpCueLists").on("change", function(){
  var chosenListKey = $(this).val();

  // Set global
	currentList = allCuelists[chosenListKey];
  listInfo = currentList["$"]

	$(".btnStartServer").prop( "disabled", false );
	$(".btnStopServer").prop( "disabled", false );
})

// Start server
$('.btnStartServer').on('click', () => {
	// Check if current session has results:
	func.getResult(function(resultData){
		if(resultData.length < 1){
			startServer()
		}else{
			dialog.showMessageBox({
				type: "question",
				buttons:["Annuleren", "Ok"],
				message: "Weet je zeker dat je deze sessie wilt starten?",
				detail: "Huidige opnames gaan verloren"
			}, function(response){
				if(response == 1){
					startServer()
				}
			});
		}
	})
})

// Reset timer
$('.btnResetTimer').on('click', function(){
	dialog.showMessageBox({
		type: "question",
		buttons:["Annuleren", "Ok"],
		message: "Weet je zeker dat je deze sessie wilt resetten?",
		detail: "Huidige opnames gaan verloren"
	}, function(response){
		if(response == 1){
			setTimer("reset");
			updateStatus("statRecvCuesCount", "0", "dark");
		}
	});
	
});

// Save subtitle file
$('.btnSave').on('click', function(){
	dialog.showSaveDialog({
			title: "Ondertitel Opslaan",
			defaultPath: '~/Showlearn.ass',
		}, (fileName) => {
    if (fileName === undefined){
        console.log("You didn't save the file");
        return;
    }else{
    	func.loadJson(fileName);
    }
  });
	
});

$('.openDebug').on('click', function(){
	electron.remote.getCurrentWindow().toggleDevTools();
});
function startServer(){
	var serverPort = $(".inpServerPort").val();

	// Set button states
	$(".inpCueLists").prop( "disabled", true );
	$(".btnStartServer").prop( "disabled", true );
	$(".btnStopServer").prop( "disabled", false );

	// Clear log window
	$(".logWindow").html("");

	cardCollapse(".colSettings .card-header", "hide")
	
  // Convert to list of objects
  var rawList = currentList.Cue
  for(key in rawList){
    cueList.push(rawList[key]["$"])
  }
  
  // Start OSC Server
  try {
  	var oscServer = new osc.Server(serverPort, '0.0.0.0');
  	setTimer("reset");
  	setTimer("run");
    updateStatus("statServer", "Gestart", "success");
  } catch (e) {
    console.log("Error: Kan server niet verbinden (" + e + ")")
    updateStatus("statServer", "Error", "danger");
  }
  
  // Handle incoming cues in gui
  func.handleOSCMsg(oscServer, listInfo.number, {
  	onCueIncoming: function(currentCue){
    	// incoming cue
    	$(".logWindow").prepend(currentCue.time + " Cue " + currentCue.number + ": " + currentCue.name + " (" + currentCue.comment + ")\n");
    	cueCount++;
    	updateStatus("statRecvCuesCount", cueCount, "dark");
    },
    onPing(){
    	$(".statHogconnection .statusValue .badge").css({backgroundColor: "#28a745"})
    	setTimeout(function(){
    		$(".statHogconnection .statusValue .badge").css({backgroundColor: "#ffc107"});
    	},200)
    	
    }
  });

  // Bind stop button
  $('.btnStopServer').off().on('click', () => {
		updateStatus("statServer", "Gestopt", "warning");
		$(".inpCueLists").prop( "disabled", false );
		$(".btnStartServer").prop( "disabled", false );
		$(".btnStopServer").prop( "disabled", true );
		oscServer.kill();
		setTimer("stop");
		//setTimer("reset");
		//updateStatus("statRecvCuesCount", "0", "dark");
	});
}
function setTimer(state){
	if(state == "run"){
		runTimer = setInterval(function(){
			var currTime = Date.now();

			var parsedTime = func.tsToTime(currTime - startTime, false);

			updateStatus("statCurrentTime", parsedTime[0]+":"+parsedTime[1]+":"+parsedTime[2], "dark")
		}, 1000);
	}else if(state == "stop"){
		clearInterval(runTimer);

	}else if(state == "reset"){
		cueCount = 0;
		startTime = Date.now();
		func.resetTimer();
		$(".logWindow").html("");
		updateStatus("statCurrentTime", "00:00:00", "dark")
	}
}

function cardCollapse(obj, state){
	var cardBody = $(obj).parent().find(".card-body");
	if(cardBody.hasClass("collapse")){
		cardBody.collapse(state);
		$(obj).find(".collapseArrow").toggleClass("down");
	}
	// if collapse is settings card adjust logwindow heigt
	if(state == "toggle"){
		$(".logWindow").toggleClass("logWindowMax")
	}else if(state == "hide"){
		$(".logWindow").addClass("logWindowMax")

	}else if(state == "show"){
		$(".logWindow").removeClass("logWindowMax")
	}

}
function updateStatus(type, value, state){
	currentItem = $("."+type+" .statusValue .badge");
	currentItem.html(value);
	currentItem.removeClass("badge-primary badge-secondary badge-success badge-danger badge-warning badge-info badge-light badge-dark")
	currentItem.addClass("badge-"+state)
}



