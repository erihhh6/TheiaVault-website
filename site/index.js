const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 8080; 
const sharp = require('sharp'); // Add Sharp for image processing
const sass = require('sass'); // Add sass for SCSS compilation

// Global object with paths for SCSS and CSS folders
const obGlobal = {
  obErori: null,
  obImagini: null,
  folderScss: path.join(__dirname, 'resurse/sass'),
  folderCss: path.join(__dirname, 'resurse/css')
};

const vect_foldere = ["temp", "backup"];

vect_foldere.forEach(folder => {
  let folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
    console.log(`Folder creat: ${folderPath}`);
  } else {
    console.log(`Folderul există deja: ${folderPath}`);
  }
  
  // Create the backup/resurse/css folder structure if the current folder is backup
  if (folder === "backup") {
    const cssBackupPath = path.join(folderPath, "resurse", "css");
    if (!fs.existsSync(path.join(folderPath, "resurse"))) {
      fs.mkdirSync(path.join(folderPath, "resurse"));
    }
    if (!fs.existsSync(cssBackupPath)) {
      fs.mkdirSync(cssBackupPath);
      console.log(`Folder creat: ${cssBackupPath}`);
    }
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function initErori() {
  fs.readFile(path.join(__dirname, 'erori.json'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading erori.json:', err);
      return;
    }
    
    obGlobal.obErori = JSON.parse(data);
    console.log('Error data loaded:', obGlobal.obErori);
  });
}

function initImagini() {
  fs.readFile(path.join(__dirname, 'resurse', 'json', 'galerie.json'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading galerie.json:', err);
      return;
    }
    
    obGlobal.obImagini = JSON.parse(data);
    console.log('Gallery data loaded');
    
    // Process images to create responsive versions
    processImagini();
  });
}

// Function to process images and create responsive versions
function processImagini() {
  if (!obGlobal.obImagini || !obGlobal.obImagini.imagini) {
    console.error('No images data available for processing');
    return;
  }
  
  const imagePaths = new Set();
  obGlobal.obImagini.imagini.forEach(img => {
    // Remove '/resurse/' prefix to get the local path
    const imagePath = img.cale_imagine.replace('/resurse/', '');
    imagePaths.add(imagePath);
  });
  
  imagePaths.forEach(imagePath => {
    const fullPath = path.join(__dirname, 'resurse', imagePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Image file not found: ${fullPath}`);
      return;
    }
    
    // Get directory and filename
    const dir = path.dirname(fullPath);
    const filename = path.basename(fullPath);
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const ext = path.extname(filename);
    
    // Create medium size (max width 600px)
    const mediumPath = path.join(dir, `${filenameWithoutExt}-medium${ext}`);
    if (!fs.existsSync(mediumPath)) {
      sharp(fullPath)
        .resize({ width: 600 })
        .toFile(mediumPath)
        .then(() => console.log(`Created medium image: ${mediumPath}`))
        .catch(err => console.error(`Error creating medium image: ${err}`));
    }
    
    // Create small size (max width 300px)
    const smallPath = path.join(dir, `${filenameWithoutExt}-small${ext}`);
    if (!fs.existsSync(smallPath)) {
      sharp(fullPath)
        .resize({ width: 300 })
        .toFile(smallPath)
        .then(() => console.log(`Created small image: ${smallPath}`))
        .catch(err => console.error(`Error creating small image: ${err}`));
    }
  });
}

// Function to compile SCSS to CSS
function compileazaScss(caleScss, caleCss) {
  try {
    // Resolve paths (absolute or relative)
    const inputPath = path.isAbsolute(caleScss) ? caleScss : path.join(obGlobal.folderScss, caleScss);
    let outputPath;
    
    if (!caleCss) {
      // If no CSS path specified, use the same name as the SCSS file but with .css extension
      const scssFileName = path.basename(caleScss, '.scss');
      outputPath = path.join(obGlobal.folderCss, `${scssFileName}.css`);
    } else {
      outputPath = path.isAbsolute(caleCss) ? caleCss : path.join(obGlobal.folderCss, caleCss);
    }
    
    // Create backup if the CSS file already exists
    if (fs.existsSync(outputPath)) {
      // Define backup path with timestamp
      const backupFolder = path.join(__dirname, "backup", "resurse", "css");
      const timestamp = Date.now();
      const fileName = path.basename(outputPath, '.css');
      const backupFileName = `${fileName}_${timestamp}.css`;
      const backupFilePath = path.join(backupFolder, backupFileName);
      
      try {
        // Copy existing CSS file to backup
        fs.copyFileSync(outputPath, backupFilePath);
        console.log(`Backup creat pentru: ${backupFilePath}`);
      } catch (err) {
        console.error(`Eroare la crearea backup-ului pentru ${outputPath}:`, err);
      }
    }
    
    // Compile SCSS to CSS
    const result = sass.compile(inputPath, {
      outputStyle: "expanded"
    });
    
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the compiled CSS to the output file
    fs.writeFileSync(outputPath, result.css);
    console.log(`Compilat: ${inputPath} -> ${outputPath}`);
  } catch (err) {
    console.error(`Eroare la compilarea SCSS ${caleScss}:`, err);
  }
}

// Watch for SCSS file changes
function watchScssFiles() {
  if (!fs.existsSync(obGlobal.folderScss)) {
    console.error(`Folderul ${obGlobal.folderScss} nu există pentru monitorizare.`);
    return;
  }
  
  console.log(`Monitorizare folder SCSS: ${obGlobal.folderScss}`);
  
  fs.watch(obGlobal.folderScss, (eventType, filename) => {
    if (filename && filename.endsWith('.scss')) {
      console.log(`Fișier SCSS modificat: ${filename}, eveniment: ${eventType}`);
      
      // Small delay to ensure the file write is complete
      setTimeout(() => {
        compileazaScss(filename);
      }, 100);
    }
  });
}

// Initial compilation of all SCSS files
function initCompileSass() {
  if (fs.existsSync(obGlobal.folderScss)) {
    const files = fs.readdirSync(obGlobal.folderScss);
    files.forEach(file => {
      if (file.endsWith('.scss')) {
        compileazaScss(file);
      }
    });
    console.log("Toate fisierele SCSS au fost compilate.");
  } else {
    console.error(`Folderul ${obGlobal.folderScss} nu există.`);
  }
}

function afisareEroare(res, identificator, titlu, text, imagine) {
  if (!obGlobal.obErori) {
    console.error('Error data not loaded yet.');
    res.status(500).send('Error data not loaded yet.');
    return;
  }
  
  const eroare = obGlobal.obErori.info_erori.find(e => e.identificator === identificator) || obGlobal.obErori.eroare_default;
  
  const statusCode = eroare.status ? identificator : 200;
  
  const errorTitlu = titlu || eroare.titlu;
  const errorText = text || eroare.text;
  const errorImagine = imagine || (eroare.imagine ? path.join(obGlobal.obErori.cale_baza, eroare.imagine) : null);
  
  console.log('Rendering error page with:', {
    titlu: errorTitlu,
    text: errorText,
    imagine: errorImagine,
    statusCode
  });
  
  res.status(statusCode).render('pagini/eroare', {
    titlu: errorTitlu,
    text: errorText,
    imagine: errorImagine
  });
}

initErori();
initImagini();
initCompileSass();
watchScssFiles(); // Start watching SCSS files for changes

app.use((req, res, next) => {
  res.locals.ip = req.ip || req.connection.remoteAddress;
  next();
});

app.use((req, res, next) => {
  if (req.path.endsWith('.ejs')) {
    afisareEroare(res, 400);
    return;
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/resurse/') && req.path.endsWith('/') && req.path !== '/resurse/') {
    afisareEroare(res, 403);
    return;
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/views/')) {
    afisareEroare(res, 400);
    return;
  }
  next();
});

app.use(express.static(path.join(__dirname, 'resurse')));

app.get(['/', '/index', '/home'], function(req, res) {
    res.render('pagini/index', {
        ip: req.ip
    });
});

app.get('/galerie-dinamica', function(req, res) {
    // Citește galeria din JSON
    let rawdata = fs.readFileSync(path.join(__dirname, "resurse", "json", "galerie.json"));
    let galerie = JSON.parse(rawdata);
    
    // Extrage imaginile pentru galeria animată
    let galerieAnimata = galerie.imagini.filter(img => img['galerie-animata'] === true);
    
    // Amestecă întregul array de imagini pentru a obține un rezultat aleatoriu
    galerieAnimata = shuffleArray(galerieAnimata);
    
    // Identifică imaginile unice (după amestecare)
    let imaginiDistincte = [];
    let imaginiUtilizate = new Set();
    
    // Determină câte imagini unice avem disponibile
    for (const img of galerieAnimata) {
        if (!imaginiUtilizate.has(img.cale_imagine)) {
            imaginiUtilizate.add(img.cale_imagine);
            imaginiDistincte.push(img);
        }
    }
    
    let numarImaginiUnice = imaginiDistincte.length;
    
    // Alege un număr aleatoriu dintre 9, 12, 15, dar nu mai mare decât numărul de imagini unice disponibile
    let optiuniNumar = [9, 12, 15].filter(n => n <= numarImaginiUnice);
    let numarAleatoriu = optiuniNumar.length > 0 ? 
                         optiuniNumar[Math.floor(Math.random() * optiuniNumar.length)] : 
                         numarImaginiUnice;
    
    // Limitează imaginile la numărul aleatoriu
    imaginiDistincte = imaginiDistincte.slice(0, numarAleatoriu);
    
    // Generăm CSS-ul din SASS pentru numărul curent de imagini
    const sass = require('sass');
    const sassResult = sass.compile(path.join(__dirname, 'resurse/sass/galerie-animata.scss'));
    fs.writeFileSync(path.join(__dirname, 'resurse/css/galerie-animata.css'), sassResult.css);
    
    res.render('pagini/galerie-dinamica', {
        ip: req.ip,
        imagini: imaginiDistincte, 
        numar_imagini: imaginiDistincte.length
    });
});

// Funcție pentru a amesteca un array (algoritmul Fisher-Yates)
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    
    // Cât timp mai sunt elemente de amestecat
    while (currentIndex != 0) {
        // Alege un element rămas
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        
        // Schimbă cu elementul curent
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    
    return array;
}

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, "resurse", "icon", "favicon.ico"));
});

app.get('/galerie-statica', (req, res) => {
  if (!obGlobal.obImagini) {
    afisareEroare(res, 500, "Eroare încărcare galerie", "Datele galeriei nu au fost încărcate încă");
    return;
  }
  
  res.render('pagini/galerie-statica', {
    imagini: obGlobal.obImagini.imagini
  });
});

app.get('/bootstrap', (req, res) => {
  res.render('pagini/bootstrap');
});

app.get('/:page', (req, res) => {
  const page = req.params.page;
  if (page === "galerie-statica") {
    return; // This route is handled separately
  }
  
  res.render(`pagini/${page}`, (err, html) => {
    if (err) {
      if (err.message.startsWith('Failed to lookup view')) {
        afisareEroare(res, 404);
      } else {
        afisareEroare(res, 500);
      }
    } else {
      res.send(html);
    }
  });
});

app.get('/contact', (req, res) => {
  res.render('pagini/contact');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

console.log('__dirname:', __dirname);
console.log('__filename:', __filename);
console.log('process.cwd():', process.cwd());