const readline = require('readline');
const {app, BrowserWindow} = require('electron')
const url = require('url')
const path = require('path')
const func = require('./main_func')

let win
var tsStart = Date.now()

global.userDataPath = app.getPath('userData');

function createWindow() {
  win = new BrowserWindow({width: 800, height: 690})
  win.loadURL(url.format ({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
    icon: path.join(__dirname, 'icons/64x64.png')
  }))
  // Open the DevTools.
  win.webContents.openDevTools()
}

app.on('ready', createWindow)

