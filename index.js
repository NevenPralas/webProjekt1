const express = require('express');
const app = express();
const qrcode = require('qrcode');
const axios = require('axios');
const { auth, requiresAuth } = require('express-openid-connect');
const dotenv = require('dotenv');
const client = require('./connection.js');

dotenv.config();

app.set('view engine', 'ejs');

app.listen(8080);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

client.connect();

// Auth0 konfiguracija
const config = {
    authRequired: false,
    auth0Logout: true,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    secret: process.env.AUTH0_CLIENT_SECRET,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    authorizationParams: {
        response_type: 'code',  
        redirect_uri: `${process.env.AUTH0_BASE_URL}/callback`, 
        scope: 'openid profile email read:ticket' 
    }
  };

  app.use(auth(config));

let ticketCounter = 0;

// Glavna ruta: odmah renderira stranicu bez čekanja na broj ticketa
app.get('/', (req, res) => {
  res.render('home', { ticketCounter: '...',  token: req.oidc.accessToken });
}
);

// Ruta za dohvaćanje broja ulaznica u JSON formatu
app.get('/ticket-count', async (req, res) => {
  try {
    const result = await client.query('SELECT COUNT(*) FROM tickets');
    const ticketCount = parseInt(result.rows[0].count);
    res.json({ ticketCounter: ticketCount });
  } catch (err) {
    console.error('Greška prilikom dohvaćanja broja ulaznica:', err);
    return res.status(500).json({ error: 'Greška prilikom dohvaćanja broja ulaznica' });
  }
});

app.get('/callback', (req, res) => {
    res.redirect('/');
});

app.get('/profile', requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user)); // Prikazat će korisničke podatke kao JSON
  });


// Prikaz forme za generiranje ulaznice
app.get('/generate', (req, res) => {
  res.render('generate', {token: req.oidc.accessToken});
});

// Generiranje QR koda i spremanje podataka u bazu
app.post('/generate', async (req, res) => {
  const { oib, ime, prezime } = req.body;

  if (!oib || !ime || !prezime) {
    return res.status(400).render('400', { natpis: 'Svi podaci (OIB, ime, prezime) su obavezni!' });
  }

  const oibRegex = /^\d{11}$/;
  if (!oibRegex.test(oib)) {
    return res.status(400).render('400', { natpis: 'OIB mora sadržavati točno 11 znamenki!' });
  }

  try {
    const result = await client.query(`SELECT COUNT(*) FROM tickets WHERE oib='${oib}'`);
    
    if (parseInt(result.rows[0].count) >= 3) {
      return res.status(400).render('400', { natpis: 'Već je kupljeno 3 ulaznice na upisani OIB' });
    }

    const uuidResult = await client.query('SELECT uuid_generate_v4()');
    const uuid = uuidResult.rows[0].uuid_generate_v4;

    const insertQuery = `INSERT INTO tickets(uuid, firstname, lastname, oib)
                         VALUES('${uuid}', '${ime}', '${prezime}', '${oib}')`;
    await client.query(insertQuery);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
    const filePath = `./qrcodeimages/${timestamp}.png`;

    await qrcode.toFile(filePath, `https://webprojekt1-slh6.onrender.com/ticket/${uuid}`);

    res.sendFile(filePath, { root: __dirname });

  } catch (err) {
    console.error('Greška prilikom operacija s bazom:', err);
    return res.status(500).send('Greška prilikom operacija s bazom');
  }
});

// Ruta za prikaz ulaznice - samo autorizirani korisnici smiju pristupiti
app.get('/ticket/:uuid', requiresAuth(), async (req, res) => {
  const trenutniUuid = req.params.uuid;
  const {oib, ime, prezime} = req.body;
  
  try {
    const result = await client.query(`SELECT firstname, lastname, oib, created_at FROM tickets WHERE uuid='${trenutniUuid}'`);

    if (result.rows.length === 0) {
      return res.status(404).send('Ulaznica s ovim UUID-om nije pronađena.');
    }

    const { firstname, lastname, oib, created_at } = result.rows[0];

    const dateObj = new Date(created_at);
    dateObj.setHours(dateObj.getHours() + 2);
    const formattedDate = dateObj.toISOString().slice(0, 19).replace('T', ' ');

    console.log(req.oidc.user.name);

    res.render('user', {
      ime: firstname,
      prezime: lastname,
      oib: oib,
      vrijemeNastanka: formattedDate,
      korisnickoIme: req.oidc.user.name,
      token: req.oidc.accessToken
    });

  } catch (err) {
    console.error('Greška prilikom otvaranja stranice o podacima:', err);
    return res.status(500).send('Greška prilikom otvaranja stranice o podacima');
  }
});

app.get('/about', (req, res) => {
  res.render('about', {token: req.oidc.accessToken});
});

// Middleware za 404
app.use((req, res) => {
  res.status(404).sendFile('./views/404.html', { root: __dirname });
});

// Zatvaranje komunikacije s bazom na CTRL+C
process.on('SIGINT', () => {
  client.end(err => {
    if (err) {
      console.error('Greška prilikom zatvaranja operacije s bazom:', err);
      return res.status(500).send('Greška prilikom operacije s bazom');
    } else {
      console.log('Konekcija s bazom uspješno zatvorena.');
    }
    process.exit(err ? 1 : 0);
  });
});