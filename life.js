let canvas, cx, nav, menu;
let side = 12, gutter = 2, rows = 0, cols = 0;
let grid = [], lifeMap = [], snapShot = [], gridID = null, running = false;
let infoDlg = null, totals;
let interval = 90, genCounter = 0;
let aliveObj, birthsObj, deathsObj;
let startButton, stopButton, clearButton;
let screens = null;
let dom_genCounter;
let deadCellColor = '#EFEFEF';
let colorIndex = localStorage.getItem('color') || 'r';
let liveCellColor = getColor(colorIndex);
let haslivedColor = shadeColors(liveCellColor);
let gamePrefix = 'GoL_';
let language = localStorage.getItem('lang') || navigator.language.split('-').shift();
let translation = {};
let infinite = false;
let mouseHandle = false;
let oldCell = '';
let root = document.querySelector(':root');

selLanguage(language);
selColor(colorIndex);

window.addEventListener('load', function(event) {
    canvas = document.querySelector('canvas');
    nav = document.querySelector('nav');
    menu = document.querySelector('aside');
    screens = document.getElementById('screens');
    startButton = document.getElementById('startButton');
    stopButton = document.getElementById('stopButton');
    clearButton = document.getElementById('clearButton');
    dom_genCounter = document.getElementById('genCounter');
    cx = canvas.getContext('2d');
    infoDlg = document.getElementById('info');
    totals = document.getElementById('totals');


    aliveObj = document.getElementById('alive');
    birthsObj = document.getElementById('births');
    deathsObj = document.getElementById('deaths');
    //cx.lineWidth = 1;

    //infoDlg.showModal();
    canvas.addEventListener('mousemove',   function(e) { e.preventDefault(); mouseEvents(e); }, false);
    canvas.addEventListener('touchmove',   function(e) { e.preventDefault(); mouseEvents(e); }, false);
    canvas.addEventListener('click',       function(e) { e.preventDefault(); mouseEvents(e, true); }, false);
    canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); mouseEvents(e, true); return false; } ); 

    initGrid();
    getAllScreens();

    setInterval(() => {
        if (running) {
            let usedPerc = usedPercent();
            totals.querySelector('span:nth-child(3) > b:first-child').textContent = usedPerc.toFixed(1) + '%';
            root.style.setProperty('--percent', usedPerc);
        }
    }, 1000)

});

window.addEventListener('resize', handleGridResize);

function hide(ele) { ele.style.display = 'none'; }
function show(ele) { ele.style.display = 'inline-block'; }

function toggleMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle('open');
}

function closeMenu(e) { console.log('closeMenu')
    e.preventDefault();
    e.stopPropagation();
    menu.classList.remove('open');
}

function selLanguage(lang, save) {
    [...document.querySelectorAll('div.langs > div > img')].forEach(ele => ele.classList.remove('sel'));
    document.querySelector('div.langs > div > img[data-lang=' + lang + ']').classList.add('sel');
    translate(lang);

    if (save) {
        localStorage.setItem('lang', lang)
    }
}

function selColor(index) {
    let color = getColor(index);
    [...document.querySelectorAll('div.colors > span.choice > b')].forEach(ele => ele.classList.remove('sel')); 
    document.querySelector('div.colors > span.choice > b[data-bkg="' + color + '"]').classList.add('sel');

    root.style.setProperty('--color', color);

    let oldLink = document.querySelector("link[rel='icon']");
    let newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.type = 'image/png';
    newLink.href = `./favicon-${index}.png`;
    document.head.removeChild(oldLink);
    document.head.appendChild(newLink);

    localStorage.setItem('color', index);

    liveCellColor = color;
    haslivedColor = shadeColors(color); 
    if (!running) { drawGrid(); }
}


function getColor(index) {
    let colors = { r:  '#ff6347', o: '#FF8C00', y: '#FFD700', g: '#3CB371', b: '#20B2AA', p: '#5c51f7', v: '#663399' }
    return colors[index];
}

async function translate(lang) {
    let resp = await fetch('/langs/' + lang + '.json');
    let eles = document.querySelectorAll('[data-trans]');
    translation = await resp.json();

    [...eles].forEach(ele => {
        let key = ele.getAttribute('data-trans');
        let target = ele.getAttribute('data-target') || 'textContent';
        let content = translation[key];

        switch (target) {
            case 'title': document.title = content; break;
            case 'aria': ele.setAttribute('aria-label', content); break;
            default: ele.textContent = content; break;
        }
    });   
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function handleGridResize() {
    if (grid && grid.length) {
        let oldGrid = clone(grid);
        let oldLMap = clone(lifeMap);
        initGrid();
        mergeScreen(oldGrid, oldLMap);
    }
}

function initGrid() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let sideGutter = side + gutter;

    rows = Math.ceil(canvas.width / sideGutter);
    cols = Math.ceil(canvas.height / sideGutter);

/*     rows = Math.ceil((canvas.width / sideGutter) * 1.25);
    cols = Math.ceil((canvas.height / sideGutter) * 1.25); */
    
    console.log(rows, cols)

    // Inicializa matriz do grid
    grid = [];
    blank(); 
    updateStats();
    drawGrid();       
}


function updateStats() {
    let rows = grid.length;
    let cols = grid[0].length;
    let usedPerc = usedPercent();

    totals.querySelector('span:first-child').textContent = rows + ' x ' + cols;
    totals.querySelector('span:nth-child(2) > b:first-child').textContent = (rows * cols) ;
    totals.querySelector('span:nth-child(3) > b:first-child').textContent = usedPerc.toFixed(1) + '%';

    root.style.setProperty('--percent', usedPerc);
}

function modifyInterval() {
    interval = 200 - (parseInt(document.getElementById('interval').value) || 90); 
}

function modifySize() {
    side = +(document.getElementById('size').value || '12');
    handleGridResize();
}

function getCellUnderMouse(coordX, coordY) {
    let boxSize = side + gutter;
    let row = Math.floor(coordX / boxSize);
    let col = Math.floor(coordY / boxSize);

    return { row, col };
}

// Processa clicks e moves
function mouseEvents(e, isClick) {
    let x = e.offsetX;
    let y = e.offsetY;
    if (e.targetTouches) { 
        x = x || e.targetTouches[0].clientX - menu.offsetWidth;
        y = y || e.targetTouches[0].clientY;
    }

    let { row, col } = getCellUnderMouse(x, y);
    let hasTouch = e.targetTouches && e.targetTouches.length;

    if (e.buttons === 1 || (isClick && e.button === 0) || hasTouch) {
        if (hasTouch) {
            let cell = grid[row][col];
            grid[row][col] = cell ? 0 : 1;
            drawCell(row, col, !!cell);
        } else {
            grid[row][col] = 1;
            drawCell(row, col, true);
        }


    } else if (e.buttons == 2 || (isClick && e.button === 2)) {
        grid[row][col] = 0;
        drawCell(row, col, false);
    }



    //if (isClick || (e.targetTouches && e.targetTouches.length)) { menu.classList.remove('open'); }
}            

function gamePlay() {
    //console.time('gen')
    generation();
    drawGrid();
    if (running) { setTimeout(gamePlay, interval); }
    //console.timeEnd('gen')
}

// Inicia o jogo
function startGame(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    snapShot = clone(grid);
    hide(startButton);
    show(stopButton);
    setTimeout(() => {
        running = true;
        gamePlay();
    }, interval);
}

// Para o jogo
function stopGame(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    running = false;
    show(startButton);
    hide(stopButton);
    updateStats();
}

// Para o jogo e mostra o que estava na tela quando o jogo iniciou
async function resetGame() {
    if (snapShot.length) { 
        if (running) { 
            stopGame(); 
            await new Promise(r => setTimeout(r, interval));
        }
        blank(); 
        grid = clone(snapShot);
        drawGrid();
        screens.selectedIndex = 0;
        genCounter = 0;
        dom_genCounter.innerText = 'Gen --';      
        
        aliveObj.textContent = '0';
        birthsObj.textContent = '0';
        deathsObj.textContent = '0';      
    }
}

// Zera a atividade e apaga o grid.
function clearGame() { 
    stopGame();
    setTimeout(function() { 
        blank(); 
        drawGrid();
        screens.selectedIndex = 0;
        genCounter = 0;
        dom_genCounter.innerText = 'Gen --';     
        aliveObj.textContent = '0';
        birthsObj.textContent = '0';
        deathsObj.textContent = '0';   

    }, running ? interval + 10 : 0);
}

// Zera a matriz bidimensional que contém a representação das células (Grid)
function blank() {
    for (let row = 0; row < rows; row++) { 
        grid[row] = new Array(cols).fill(0);
        lifeMap[row] = new Array(cols).fill(0);
    }

}

// Computa uma geração
function generation() {
    console.time('GEN')
    let changeTrack = [];
    let births = 0;
    let deaths = 0;
    let alive  = 0;

    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            
            let neigh = countNeighbors(row, col);

            if (grid[row][col] == 0) {
                // Vazio
                if (neigh == 3) {
                    // Nasceu
                    changeTrack.push({ r: row, c: col, v: 1 });
                    births++;
                    alive++;
                }
            } else {
                // Cheio
                switch(neigh) {
                    case 0:
                    case 1:
                        // Morreu por isolamento
                        changeTrack.push({ r: row, c: col, v: 0 });
                        lifeMap[row][col] = 1;
                        deaths++;
                        break;
                    case 2:
                    case 3:
                        // Sobreviveu, não faça nada
                        alive++;
                        break;
                    default:
                        // Morreu por superpopulação
                        changeTrack.push({ r: row, c: col, v: 0 });
                        lifeMap[row][col] = 1;
                        deaths++;
                        break;
                }
            }
        }
    }

    if (!changeTrack.length) {
        stopGame();
    } else {
        changeTrack.forEach(function(cell) { grid[cell.r][cell.c] = cell.v; });
        genCounter++;
        dom_genCounter.innerText = 'Gen ' + genCounter;
    } 

    aliveObj.textContent = alive;
    birthsObj.textContent = births;
    deathsObj.textContent = deaths;
    console.timeEnd('GEN')

}

function countNeighbors(row, col) {
    let resp = 0;
    let OffsetX = [-1,  0,  1, 1, 1, 0, -1, -1];
    let OffsetY = [-1, -1, -1, 0, 1, 1,  1,  0];
    
    if (infinite) {
        for (let i = 0; i < 8; i++) {
            let xx = row + OffsetX[i];
            let yy = col + OffsetY[i];
            
            if (xx < 0) { xx = rows - 1; }
            if (xx >= rows) { xx = 0; } 
            if (yy < 0) { yy = cols - 1; }
            if (yy >= cols) { yy = 0; }
 
            if (grid[xx][yy] != 0) { resp++; } 
        }
    } else {      
        for (let i = 0; i < 8; i++) {
            let xx = row + OffsetX[i];
            let yy = col + OffsetY[i];
            
            if (xx >= 0 && xx < rows && yy >= 0 && yy < cols) {
                if (grid[xx][yy] != 0) { resp++; }                       
            } 
        }        
    }

    return resp;
}

function drawCell(row, col, paint) {
    switch (paint) {
        case true: cx.fillStyle = liveCellColor; break;
        case false: cx.fillStyle = lifeMap[row][col] ? haslivedColor : deadCellColor; break;
        default:
            cx.fillStyle = grid[row][col] ? liveCellColor : lifeMap[row][col] ? haslivedColor : deadCellColor;
    }

    let sz = side + gutter;
    let inix = gutter + (sz * row);
    let iniy = gutter + (sz * col);
    cx.fillRect(inix, iniy, side, side);
/*     cx.arc(inix + side / 2, iniy + side / 2, side, 0, 2 * Math.PI);
    cx.stroke(); */
}

function drawGrid() {
    //console.time('DRAWGRID')
    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            drawCell(row, col); 
        }
    }
    //console.timeEnd('DRAWGRID')
}

function rgb2Hex(r, g, b) {
    //if (r > 255 || g > 255 || b > 255) { throw "Invalid color component"; }
    return ((r << 16) | (g << 8) | b).toString(16);
}

function saveScreen() { console.log(screens.value)
    let curScreen = screens.value;

    if (curScreen) {
        localStorage.setItem(curScreen, JSON.stringify(grid));
        getAllScreens(name);
    } else {
        let name = prompt('Enter a name');
        if (name) {
            let names = [...(document.querySelectorAll('#screens > option') || [])].map(s => s.text);
            if (names.includes(name)) {
                alert(translation.errnameexists);
                return;
            }

            localStorage.setItem(gamePrefix + name, JSON.stringify(grid));
            getAllScreens(name);
        }        
    }

}

function getAllScreens(preSelKey) {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(gamePrefix)).sort();
    screens.length = 0;

    allKeys.unshift('')
    allKeys.forEach(key => {
        let opt = document.createElement("option");
        let name = key.replace(gamePrefix, '');
        opt.text = name;
        opt.value = key;
        opt.selected = preSelKey == key;
        screens.appendChild(opt);
    });
}

function loadScreen(name) { 
    if (!name) { blank(); return; }
    let screen = localStorage.getItem(name); 
    if (screen) {
        try {
            let arr = JSON.parse(screen);
/*             let scrRows = arr.length;
            let scrCols = arr[0].length;

            for (let row = 0; row < rows; row++) { 
                for (let col = 0; col < cols; col++) { 
                    lifeMap[row][col] = 0; 
                    if (row < scrRows && col < scrCols) { 
                        grid[row][col] = arr[row][col] || 0; 
                        drawCell(row, col);
                    }
                }
            } */
            mergeScreen(arr);
            genCounter = 0;
            dom_genCounter.innerText = genCounter;

        } catch (error) {
            alert(translation.errnoload + ' ' + name)
        }
    }
}


function mergeScreen(grdArr, lmapArr) {
    let scrRows = grdArr.length;
    let scrCols = grdArr[0].length;

    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            if (row < scrRows && col < scrCols) { 
                grid[row][col] = grdArr[row][col] || 0; 
                lifeMap[row][col] = lmapArr ? lmapArr[row][col] || 0 : 0;
                drawCell(row, col);
            }
        }
    }
}

function chooseScreen() { 
    initGrid();
    loadScreen(screens.value || '');
    snapShot = clone(grid);
}

function getBounds() {
    console.log(getItemBounds(grid));
}


function deleteScreen() {
    if (screens.value) {
        let name = screens.value.replace(gamePrefix, '')
        if (confirm('Deletar a tela ' + name)) {
            localStorage.removeItem(screens.value);
            getAllScreens();
        }
    }
}

function controlMouse(e, op, dir) {
    if (op == 'p') {
        clearInterval(mouseHandle);
        mouseHandle = setInterval(() => moveGrid(dir), 50);
    } else {
        clearInterval(mouseHandle);
    }
    
}

function moveGrid(dir) { 
    //if (mouseFlag) {
        let scrRows = grid.length;
        let scrCols = grid[0].length;

        switch(dir) {
            case 'l':
                grid.shift();
                grid.push(new Array(scrCols). fill(0));
                break;
            case 'r':
                grid.pop();
                grid.unshift(new Array(scrCols). fill(0));   
                break;
            case 'u':
                grid.forEach(g => {
                    g.shift();
                    g.push(0);
                });  
                break;   
            case 'd':
                grid.forEach(g => {
                    g.pop();
                    g.unshift(0);
                });               
        }
        drawGrid();
    //}
}


function shadeColors(color, percent = 0.70) {
    let f = parseInt(color.slice(1), 16);
    let t = percent < 0 ? 0 : 255;
    let p = percent < 0 ? percent * -1 : percent;
    let R = f >> 16;
    let G = f >> 8 & 0x00FF;
    let B = f & 0x0000FF;
    let resp = (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B));
    return '#' + resp.toString(16).slice(1);
}


function usedPercent() {
    let usedCells = 0;
    let totalRows = lifeMap.length;
    let totalCols = lifeMap[0].length;
    let total = totalRows * totalCols;

    for (let row = 0; row < totalRows; row++) { 
        for (let col = 0; col < totalCols; col++) { 
            usedCells += lifeMap[row][col] ? 1 : 0;
        }
    }
    return +(usedCells * 100 / total).toFixed(1);
}

function getItemBounds(arr) {
    let rows = arr.length;
    let cols = arr[0].length;
    let bounds = { inix: Number.MAX_VALUE, iniy: Number.MAX_VALUE, endx: 0, endy: 0 }

    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            if (arr[row][col]) {
                bounds.inix = Math.min(bounds.inix, row);
                bounds.iniy = Math.min(bounds.iniy, col);
                bounds.endx = Math.max(bounds.endx, row);
                bounds.endy = Math.max(bounds.endy, col);
            }
        }
    }
    return bounds;
}


function showInfo() {
    infoDlg.showModal();
}

function closeDialog() {
    infoDlg.close();
}


