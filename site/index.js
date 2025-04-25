const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 8080; 
const sharp = require('sharp'); // Add Sharp for image processing

const vect_foldere = ["temp"];

vect_foldere.forEach(folder => {
  let folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
    console.log(`Folder creat: ${folderPath}`);
  } else {
    console.log(`Folderul există deja: ${folderPath}`);
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const obGlobal = {
  obErori: null,
  obImagini: null
};

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

app.get(['/', '/index', '/home'], (req, res) => {
  res.render('pagini/index');
});

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