let canvas, cx, nav, menu;
let side = 12, gutter = 2, rows = 0, cols = 0;
let grid = [], lifeMap = [], gridID = null, running = false;
let interval = 90, genCounter = 0;
let startButton, stopButton, clearButton;
let screens = null;
let dom_genCounter;
let deadCellColor = '#EFEFEF';
let liveCellColor = '#FF6347';
let haslivedColor = '#FFD4CC';
let gamePrefix = 'GoL_';
let language = localStorage.getItem('lang') || navigator.language.split('-').shift();
let color = '';

selLanguage(language);
selColor('#ff6347');

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
    cx.lineWidth = 1;

    canvas.addEventListener('mousemove', function(e) { e.preventDefault(); mouseEvents(e); }, false);
    canvas.addEventListener('touchmove', function(e) { e.preventDefault(); mouseEvents(e); }, false);
    canvas.addEventListener('click', function(e) { e.preventDefault(); mouseEvents(e, true); }, false);
    canvas.addEventListener('contextmenu', (e)=> { e.preventDefault(); mouseEvents(e, true); return false; } ); 

    initGrid();
    getAllScreens();
});

window.addEventListener('resize', initGrid);

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

function selColor(clr) {
    [...document.querySelectorAll('div.colors > span.choice > b')].forEach(ele => ele.classList.remove('sel')); 
    document.querySelector('div.colors > span.choice > b[data-bkg="' + clr + '"]').classList.add('sel');

    let root = document.querySelector(':root');
    root.style.setProperty('--color', clr);

    color = clr;
}

async function translate(lang) {
    let resp = await fetch('/langs/' + lang + '.json');
    let translation = await resp.json();
    let eles = document.querySelectorAll('[data-trans]');

    [...eles].forEach(ele => {
        let key = ele.getAttribute('data-trans');
        let target = ele.getAttribute('data-target') || 'textContent';
        let content = translation[key];

        switch (target) {
            case 'title': document.title = content; break;

            default: ele.textContent = content; break;
        }
    })
    console.log(eles)
    
}

function initGrid() {
    let oldGrid
    if (grid.length) {
        oldGrid = JSON.parse(JSON.stringify(grid));
    }
    canvas.width = canvas.offsetWidth;
    canvas.height = document.body.scrollHeight - 50;

    let sideGutter = side + gutter;

    rows = Math.floor(canvas.width / sideGutter);
    cols = Math.floor(canvas.height / sideGutter);
    
    console.log(rows, cols)

    canvas.width = rows * sideGutter + gutter;
    canvas.height = cols * sideGutter + gutter;         
    
    // Inicializa matriz do grid
    grid = [];
    for (let row = 0; row < rows; row++) { 
        grid[row] = [];
        lifeMap[row] = [];
        for (let col = 0; col < cols; col++) { 
            grid[row][col] = 0; 
            lifeMap[row][col] = 0; 
        }
    }   
    document.getElementById('total').innerHTML = '<b>' + rows + ' x ' + cols + '</b><small>' + (rows * cols) + '</small>';      
    drawGrid();       
}


function modifyInterval() {
    interval = +(document.getElementById('interval').value || '90'); console.log(interval)
}

function modifySize() {
    side = +(document.getElementById('size').value || '12');
    initGrid();
}

function getCellUnderMouse(coordX, coordY) {
    let x = coordX - canvas.offsetLeft - gutter - 1;
    let y = coordY - canvas.offsetTop - gutter - 1;

    let row = Math.floor(x / (side + gutter));
    let col = Math.floor(y / (side + gutter));
    return { row, col };
}

// Processa clicks e moves
function mouseEvents(e, isClick) {
    let { row, col } = getCellUnderMouse(e.pageX || e.targetTouches[0].pageX, e.pageY || e.targetTouches[0].pageY)

    if (e.buttons === 1 || (isClick && e.button === 0) || (e.targetTouches && e.targetTouches.length)) {
        grid[row][col] = 1;
        drawCell(row, col, true);

    } else if (e.buttons == 2 || (isClick && e.button === 2)) {
        grid[row][col] = 0;
        drawCell(row, col, false);
    }

    if (isClick || (e.targetTouches && e.targetTouches.length)) { menu.classList.remove('open'); }
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
    running = true;
    hide(startButton);
    show(stopButton);
    setTimeout(gamePlay, interval);
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
    //if (gridID) { clearInterval(gridID); }
    
}

// Zera a atividade e apaga o grid.
function clearGame() { 
    stopGame();
    setTimeout(function() { 
        blank(); 
        drawGrid();
        genCounter = 0;
        dom_genCounter.innerText = genCounter;        
    }, running ? interval + 10 : 0);
}

// Zera a matriz bidimensional que contém a representação das células (Grid)
function blank() {
    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            grid[row][col] = 0; 
            lifeMap[row][col] = 0; 
        }
    }
    screens.selectedIndex = 0;
}

// Computa uma geração
function generation() {
    //console.time('GEN')
    let changeTrack = [];

    for (let row = 0; row < rows; row++) { 
        for (let col = 0; col < cols; col++) { 
            
            let neigh = countNeighbors(row, col);

            if (grid[row][col] == 0) {
                // Vazio
                if (neigh == 3) {
                    // Nasceu
                    changeTrack.push({ r: row, c: col, v: 1 });
                }
            } else {
                // Cheio
                switch(neigh) {
                    case 0:
                    case 1:
                        // Morreu por isolamento
                        changeTrack.push({ r: row, c: col, v: 0 });
                        lifeMap[row][col] = 1;
                        break;
                    case 2:
                    case 3:
                        // Sobreviveu, não faça nada
                        break;
                    default:
                        // Morreu por superpopulação
                        changeTrack.push({ r: row, c: col, v: 0 });
                        lifeMap[row][col] = 1;
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
        dom_genCounter.innerText = genCounter;
    } 
    //console.timeEnd('GEN')
}

function countNeighbors(row, col) {
    let resp = 0;
    let OffsetX = [-1, 0, 1, 1, 1, 0, -1, -1];
    let OffsetY = [-1, -1, -1, 0, 1, 1, 1, 0];
    
    for (let i = 0; i < 8; i++) {
        let xx = row + OffsetX[i];
        let yy = col + OffsetY[i];
        
        if (xx >= 0 && xx < rows && yy >= 0 && yy < cols) {
            if (grid[xx][yy] != 0) { resp++; }                       
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

function saveScreen() {
    let name = prompt('Enter a name');
    if (name) {
        localStorage.setItem(gamePrefix + name, JSON.stringify(grid));

        getAllScreens(name);
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

function loadScreen(name) { console.log(name)
    if (!name) { blank(); return; }
    let screen = localStorage.getItem(name); console.log(screen)
    if (screen) {
        try {
            let arr = JSON.parse(screen);
            let scrRows = arr.length;
            let scrCols = arr[0].length;

            for (let row = 0; row < rows; row++) { 
                for (let col = 0; col < cols; col++) { 
                    lifeMap[row][col] = 0; 
                    if (row < scrRows && col < scrCols) { 
                        grid[row][col] = arr[row][col] || 0; 
                        drawCell(row, col);
                    }
                }
            }
            genCounter = 0;
            dom_genCounter.innerText = genCounter;

        } catch (error) {
            alert('Could not load screen ' + name)
        }
    }
}

function chooseScreen() { 
    loadScreen(screens.value || '');
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


function moveGrid(dir) {
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
}