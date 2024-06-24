let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
document.querySelector("#canvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");

// breedte en hoogte van gamezone
const W = (dom_canvas.width = 400);
const H = (dom_canvas.height = 400);

// Initialisatie van variabelen voor het Snake-spel
let snake,
  food,
  currentHue,
  cells = 20,
  cellSize,
  isGameOver = false,
  tails = [],
  score = 0,
  maxScore = window.localStorage.getItem("maxScore") || undefined,
  particles = [],
  splashingParticleCount = 20,
  cellsCount,
  requestID;

// Helper object met verschillende hulpmiddelen voor het Snake-spel
let helpers = {
  // Klasse voor vectoren die gebruikt worden voor positie en beweging
  Vec: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    // Voeg een vector toe aan de huidige vector
    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }
    // Vermenigvuldig de huidige vector met een andere vector of een scalaire waarde
    mult(v) {
      if (v instanceof helpers.Vec) {
        this.x *= v.x;
        this.y *= v.y;
        return this;
      } else {
        this.x *= v;
        this.y *= v;
        return this;
      }
    }
  },
  // Controleer of twee vectoren botsen (dezelfde positie hebben)
  isCollision(v1, v2) {
    return v1.x == v2.x && v1.y == v2.y;
  },
  // Verwijder deeltjes die niet meer zichtbaar zijn (grootte <= 0)
  garbageCollector() {
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].size <= 0) {
        particles.splice(i, 1);
      }
    }
  },
  // Teken een raster op de achtergrond van het speelveld
  drawGrid() {
    CTX.lineWidth = 1.1;
    CTX.strokeStyle = "#232332";
    CTX.shadowBlur = 0;
    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;
      CTX.beginPath();
      CTX.moveTo(f, 0);
      CTX.lineTo(f, H);
      CTX.stroke();
      CTX.beginPath();
      CTX.moveTo(0, f);
      CTX.lineTo(W, f);
      CTX.stroke();
      CTX.closePath();
    }
  },
  // Genereer een willekeurige kleurtoon tussen 0 en 360 graden
  randHue() {
    return ~~(Math.random() * 360);
  },
  // Converteer HSL-kleuren naar RGB-kleuren
  hsl2rgb(hue, saturation, lightness) {
    if (hue == undefined) {
 // bilal start
      return [0, 0, 0];
    }
    var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    var huePrime = hue / 60;
    var secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

    huePrime = ~~huePrime;
    var red;
    var green;
    var blue;

    if (huePrime === 0) {
      // Hue ligt tussen 0° en 60°
      // Maximaal rood, een beetje groen, geen blauw
      red = chroma;
      green = secondComponent;
      blue = 0;
    } else if (huePrime === 1) {
      // Hue ligt tussen 60° en 120°
      // Maximaal groen, een beetje rood, geen blauw
      red = secondComponent;
      green = chroma;
      blue = 0;
    } else if (huePrime === 2) {
      // Hue ligt tussen 120° en 180°
      // Maximaal groen, een beetje blauw, geen rood
      red = 0;
      green = chroma;
      blue = secondComponent;
    } else if (huePrime === 3) {
      // Hue ligt tussen 180° en 240°
      // Maximaal blauw, een beetje groen, geen rood
      red = 0;
      green = secondComponent;
      blue = chroma;
    } else if (huePrime === 4) {
      // Hue ligt tussen 240° en 300°
      // Maximaal blauw, een beetje rood, geen groen
      red = secondComponent;
      green = 0;
      blue = chroma;
    } else if (huePrime === 5) {
      // Hue ligt tussen 300° en 360°
      // Maximaal rood, een beetje blauw, geen groen
      red = chroma;
      green = 0;
      blue = secondComponent;
    }
    

    var lightnessAdjustment = lightness - chroma / 2;
    red += lightnessAdjustment;
    green += lightnessAdjustment;
    blue += lightnessAdjustment;

    return [
      Math.round(red * 255),
      Math.round(green * 255),
      Math.round(blue * 255)
    ];
  },
  // Lineaire interpolatie tussen twee waarden
  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }
};



// Object om toetsinvoer (pijltjestoetsen) te beheren
let KEY = {
  ArrowUp: false,        // Status van de pijl-omhoog toets
  ArrowRight: false,     // Status van de pijl-rechts toets
  ArrowDown: false,      // Status van de pijl-omlaag toets
  ArrowLeft: false,      // Status van de pijl-links toets
  // Functie om alle toetsstatussen te resetten
  resetState() {
    this.ArrowUp = false;
    this.ArrowRight = false;
    this.ArrowDown = false;
    this.ArrowLeft = false;
  },
  // Functie om te luisteren naar toetsaanslagen en de status van toetsen bij te werken
  listen() {
    addEventListener(
      "keydown",
      (e) => {
        // Voorkom tegengestelde bewegingen 
        if (e.key === "ArrowUp" && this.ArrowDown) return;
        if (e.key === "ArrowDown" && this.ArrowUp) return;
        if (e.key === "ArrowLeft" && this.ArrowRight) return;
        if (e.key === "ArrowRight" && this.ArrowLeft) return;
        // Zet de status van de ingedrukte toets op true
        this[e.key] = true;
        // Reset de status van alle andere toetsen naar false
        Object.keys(this)
          .filter((f) => f !== e.key && f !== "listen" && f !== "resetState")
          .forEach((k) => {
            this[k] = false;
          });
      },
      false
    );
  }
};


// Klasse voor de Snake (slang) in het spel
class Snake {
  // Constructor om de slang te initialiseren
  constructor(i, type) {
    this.pos = new helpers.Vec(W / 2, H / 2);       // Positie van de slang (midden van het speelveld)
    this.dir = new helpers.Vec(0, 0);               // Richting van de slang (initieel stilstaand)
    this.type = type;                               // Type slang (voor eventuele variaties)
    this.index = i;                                 // Index van de slang (voor meerdere slangen, indien nodig)
    this.delay = 5;                                 // Vertraging voor de beweging van de slang
    this.size = W / cells;                          // Grootte van de slang (afhankelijk van het aantal cellen)
    this.color = "green";                           // Kleur van de slang
    this.history = [];                              // Geschiedenis van de posities van de slang (voor staart)
    this.total = 1;                                 // Totale lengte van de slang (initieel 1 segment)
  }
  
  // Methode om de slang te tekenen op het canvas
  draw() {
    let { x, y } = this.pos;
    CTX.fillStyle = this.color;
    CTX.shadowBlur = 20;
    CTX.shadowColor = "rgba(255,255,255,.3 )";
    CTX.fillRect(x, y, this.size, this.size);      // Teken het hoofd van de slang
    CTX.shadowBlur = 0;
    if (this.total >= 2) {                         // Teken de staart als de slang langer is dan 1 segment
      for (let i = 0; i < this.history.length - 1; i++) {
        let { x, y } = this.history[i];
        CTX.lineWidth = 1;
        CTX.fillStyle = "rgba(225,225,225,1)";
        CTX.fillRect(x, y, this.size, this.size);
      }
    }
  }

  // Methode om de slang te laten teleporteren bij het raken van de muur
  walls() {
    let { x, y } = this.pos;
    if (x + cellSize > W) {                      // Rechter muur
      this.pos.x = 0;
    }
    if (y + cellSize > W) {                      // Onder muur
      this.pos.y = 0;
    }
    if (y < 0) {                                 // Boven muur
      this.pos.y = H - cellSize;
    }
    if (x < 0) {                                 // Linker muur
      this.pos.x = W - cellSize;
    }
  }

  // Methode om de slang te besturen met de pijltjestoetsen
  controlls() {
    let dir = this.size;
    if (KEY.ArrowUp) {
      this.dir = new helpers.Vec(0, -dir);
    }
    if (KEY.ArrowDown) {
      this.dir = new helpers.Vec(0, dir);
    }
    if (KEY.ArrowLeft) {
      this.dir = new helpers.Vec(-dir, 0);
    }
    if (KEY.ArrowRight) {
      this.dir = new helpers.Vec(dir, 0);
    }
  }

  // Methode om te controleren of de slang zichzelf raakt
  selfCollision() {
    for (let i = 0; i < this.history.length; i++) {
      let p = this.history[i];
      if (helpers.isCollision(this.pos, p)) {
        isGameOver = true;
      }
    }
  }

  // Methode om de positie en status van de slang bij te werken
  update() {
    this.walls();                  // Controleer muurbotsingen
    this.draw();                   // Teken de slang
    this.controlls();              // Verwerk invoer voor besturing
    if (!this.delay--) {           // Beweeg de slang na de vertraging
      if (helpers.isCollision(this.pos, food.pos)) {   // Controleer botsing met voedsel
        incrementScore();              // Verhoog de score
        particleSplash();               // Voeg deeltjes toe voor visuele effecten
        food.spawn();                   // Laat nieuw voedsel verschijnen
        this.total++;                   // Verleng de slang
      }
      this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);
      for (let i = 0; i < this.total - 1; i++) {      // Update de geschiedenis van de posities
        this.history[i] = this.history[i + 1];
      }
      this.pos.add(this.dir);                         // Verplaats de slang in de huidige richting
      this.delay = 5;                                 // Reset de vertraging
      this.total > 3 ? this.selfCollision() : null;   // Controleer zelfbotsingen als de slang lang genoeg is
    }
  }
}

// Klasse voor het voedsel in het Snake-spel
class Food {
  // Constructor om het voedsel te initialiseren
  constructor() {
    this.pos = new helpers.Vec(
      ~~(Math.random() * cells) * cellSize, // Willekeurige X-positie binnen het raster
      ~~(Math.random() * cells) * cellSize  // Willekeurige Y-positie binnen het raster
    );
    this.color = currentHue = `hsl(${~~(Math.random() * 360)},100%,50%)`; // Willekeurige kleur voor het voedsel
    this.size = cellSize;  // Grootte van het voedsel (gelijk aan de celgrootte)
  }
  
  // Methode om het voedsel te tekenen op het canvas
  draw() {
    let { x, y } = this.pos;
    CTX.globalCompositeOperation = "lighter";  // Instelling voor lichteffecten
    CTX.shadowBlur = 20;  // Schaduw rondom het voedsel
    CTX.shadowColor = this.color;  // Kleur van de schaduw
    CTX.fillStyle = this.color;  // Kleur van het voedsel
    CTX.fillRect(x, y, this.size, this.size);  // Teken het voedsel als een rechthoek
    CTX.globalCompositeOperation = "source-over";  // Terug naar normale instellingen
    CTX.shadowBlur = 0;  // Schaduw uitschakelen
  }

  // Methode om nieuw voedsel te laten verschijnen op een willekeurige positie
  spawn() {
    let randX = ~~(Math.random() * cells) * this.size; // Willekeurige X-positie binnen het raster
    let randY = ~~(Math.random() * cells) * this.size; // Willekeurige Y-positie binnen het raster
    for (let path of snake.history) {  // Controleer of de nieuwe positie op de slang ligt
      if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
        return this.spawn();  // Als dat zo is, probeer een nieuwe positie
      }
    }
    this.color = currentHue = `hsl(${helpers.randHue()}, 100%, 50%)`; // Nieuwe willekeurige kleur voor het voedsel
    this.pos = new helpers.Vec(randX, randY); // Stel de nieuwe positie van het voedsel in
  }
}

// Klasse voor deeltjes in het spel
class Particle {
  // Constructor om een deeltje te initialiseren
  constructor(pos, color, size, vel) {
    this.pos = pos;                     // Positie van het deeltje
    this.color = color;                 // Kleur van het deeltje
    this.size = Math.abs(size / 2);     // Grootte van het deeltje (positieve waarde)
    this.ttl = 0;                       // 'Time to live' - levensduur van het deeltje
    this.gravity = -0.2;                // Zwaartekracht (negatieve waarde voor omhoog)
    this.vel = vel;                     // Snelheid (vector) van het deeltje
  }

  // Methode om het deeltje te tekenen op het canvas
  draw() {
    let { x, y } = this.pos;
    let hsl = this.color
      .split("")
      .filter((l) => l.match(/[^hsl()$% ]/g))
      .join("")
      .split(",")
      .map((n) => +n);
    let [r, g, b] = helpers.hsl2rgb(hsl[0], hsl[1] / 100, hsl[2] / 100);
    CTX.shadowColor = `rgb(${r},${g},${b},${1})`;  // Schaduwkleur van het deeltje
    CTX.shadowBlur = 0;                            // Geen schaduwvervaging
    CTX.globalCompositeOperation = "lighter";      // Lichter compositie-effect
    CTX.fillStyle = `rgb(${r},${g},${b},${1})`;   // Vul het deeltje met de berekende kleur
    CTX.fillRect(x, y, this.size, this.size);      // Teken het deeltje als een rechthoek
    CTX.globalCompositeOperation = "source-over";  // Terug naar normale compositie
  }

  // Methode om het deeltje te updaten (positie, grootte, levensduur, snelheid)
  update() {
    this.draw();                      // Teken het deeltje
    this.size -= 0.3;                 // Verminder de grootte van het deeltje
    this.ttl += 1;                    // Verhoog de 'time to live' van het deeltje
    this.pos.add(this.vel);           // Pas de positie van het deeltje toe met de snelheid
    this.vel.y -= this.gravity;       // Pas de verticale snelheid aan met de zwaartekracht
  }
}

// Functie om de score te verhogen en de scoreweergave in de DOM bij te werken
function incrementScore() {
  score++;                              // Verhoog de score met 1
  dom_score.innerText = score.toString().padStart(2, "0");  // Werk de scoreweergave in de DOM bij
}


// Functie om deeltjes te laten spatten bij het eten van voedsel
function particleSplash() {
  for (let i = 0; i < splashingParticleCount; i++) {
    let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3); // Willekeurige snelheid voor het deeltje
    let position = new helpers.Vec(food.pos.x, food.pos.y);  // Positie van het deeltje is gelijk aan de positie van het voedsel
    particles.push(new Particle(position, currentHue, food.size, vel)); // Voeg nieuw deeltje toe aan deeltjes-array
  }
}


// Functie om het canvas te wissen
function clear() {
  CTX.clearRect(0, 0, W, H);  // Wis het hele canvas van (0,0) tot (W,H)
}


// Functie om het spel te initialiseren
function initialize() {
  CTX.imageSmoothingEnabled = false;  // Zet het gladmaken van afbeeldingen uit voor het canvas
  KEY.listen();                       // Luister naar toetsenbordinvoer voor besturing
  cellsCount = cells * cells;         // Bereken het totale aantal cellen in het raster
  cellSize = W / cells;               // Bereken de grootte van elke cel in het raster
  snake = new Snake();                // Maak een nieuwe slang aan
  food = new Food();                  // Maak nieuw voedsel aan
  dom_replay.addEventListener("click", reset, false);  // Voeg een eventlistener toe aan de replay-knop
  loop();                             // Start de spel-lus
}

// Spel-lus functie om het spel te laten draaien
function loop() {
  clear();  // Wis het canvas

  if (!isGameOver) {  // Als het spel niet voorbij is
    requestID = setTimeout(loop, 1000 / 60);  // Vraag de volgende frame aan
    helpers.drawGrid();  // Teken het raster op het canvas
    snake.update();      // Werk de slang bij (beweging, controle, botsingen)
    food.draw();         // Teken het voedsel op het canvas

    // Werk elk deeltje bij en teken het
    for (let p of particles) {
      p.update();
    }

    helpers.garbageCollector();  // Verwijder onnodige deeltjes
  } else {  // Als het spel voorbij is (game over)
    clear();    // Wis het canvas
    gameOver(); // Laat het game-over scherm zien
  }
}


// Functie om het speloverzicht weer te geven
function gameOver() {
  // Update de maximale score indien nodig
  maxScore ? null : (maxScore = score);         // Als maxScore nog niet is ingesteld, stel het in op de huidige score
  score > maxScore ? (maxScore = score) : null;  // Als de huidige score hoger is dan maxScore, update maxScore

  // Sla de maximale score op in de lokale opslag van de browser
  window.localStorage.setItem("maxScore", maxScore);

  // Tekstinstellingen voor het game-over scherm
  CTX.fillStyle = "#4cffd7";                    // Vulkleur voor de tekst
  CTX.textAlign = "center";                     // Tekst uitlijning in het midden
  CTX.font = "bold 30px Poppins, sans-serif";   // Lettertype en grootte voor de titel "GAME OVER"
  CTX.fillText("GAME OVER", W / 2, H / 2);      // Tekenen van "GAME OVER" in het midden van het canvas

  // Tekstinstellingen voor het tonen van de score en maximale score
  CTX.font = "15px Poppins, sans-serif";        // Lettertype en grootte voor de scores
  CTX.fillText(`SCORE   ${score}`, W / 2, H / 2 + 60);   // Tekenen van de huidige score onder "SCORE"
  CTX.fillText(`MAXSCORE   ${maxScore}`, W / 2, H / 2 + 80); // Tekenen van de maximale score onder "MAXSCORE"
}


// Functie om het spel te resetten
function reset() {
  dom_score.innerText = "00";      // Zet de score in de DOM terug naar "00"
  score = 0;                       // Reset de score naar 0 (als numerieke waarde)
  snake = new Snake();             // Maak een nieuwe slang aan
  food.spawn();                    // Laat nieuw voedsel verschijnen
  KEY.resetState();                // Reset de toetsenbordstatus
  isGameOver = false;              // Zet het game-over status terug naar false
  clearTimeout(requestID);        // Stop het huidige spel-lusverzoek (indien aanwezig)
  loop();                          // Start de spel-lus opnieuw
}


initialize();