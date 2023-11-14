import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board, Cell } from "./board";

interface Coin {
  i: number;
  j: number;
  serial: number;
}

interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class Geocache implements Memento<string> {
  i: number;
  j: number;
  numCoins: number;

  constructor(i: number, j: number, numCoins = 0) {
    this.i = i;
    this.j = j;
    this.numCoins = numCoins;
  }

  toMemento(): string {
    return this.numCoins.toString();
  }

  fromMemento(memento: string): void {
    this.numCoins = parseInt(memento);
  }
}

const PLAYER_LOCATION = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;
const MAX_INITIAL_COINS = 3;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const mapContainer = document.querySelector<HTMLElement>("#map")!;

const mementos = new Map<string, string>();

const map = leaflet.map(mapContainer, {
  center: PLAYER_LOCATION,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
  })
  .addTo(map);

let playerMarker = leaflet.marker(PLAYER_LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const playerCoins: Coin[] = [];

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

const north = document.querySelector("#north")!;
north.addEventListener("click", () => {
  playerMarker.getLatLng().lat += TILE_DEGREES;
  playerMarker = moveMarker(playerMarker, playerMarker.getLatLng());
  generateNeighborhood(playerMarker.getLatLng());
});

const south = document.querySelector("#south")!;
south.addEventListener("click", () => {
  playerMarker.getLatLng().lat -= TILE_DEGREES;
  playerMarker = moveMarker(playerMarker, playerMarker.getLatLng());
  generateNeighborhood(playerMarker.getLatLng());
});

const west = document.querySelector("#west")!;
west.addEventListener("click", () => {
  playerMarker.getLatLng().lng -= TILE_DEGREES;
  playerMarker = moveMarker(playerMarker, playerMarker.getLatLng());
  generateNeighborhood(playerMarker.getLatLng());
});

const east = document.querySelector("#east")!;
east.addEventListener("click", () => {
  playerMarker.getLatLng().lng += TILE_DEGREES;
  playerMarker = moveMarker(playerMarker, playerMarker.getLatLng());
  generateNeighborhood(playerMarker.getLatLng());
});

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// stores tiles so they can be removed later
const tiles: leaflet.Layer[] = [];

function makeGeocache(i: number, j: number) {
  const cell: Cell = { i, j };
  const bounds = board.getCellBounds(cell);
  const geocacheRect = leaflet.rectangle(bounds) as leaflet.Layer;
  tiles.push(geocacheRect);

  let value = Math.floor(luck([i, j, "initialValue"].toString()) * MAX_INITIAL_COINS);

  const cellI = i * TILE_DEGREES;
  const cellJ = j * TILE_DEGREES;

  const geocache = new Geocache(cellI, cellJ);

  const loadedValue = loadFromMementos(geocache);

  if (loadedValue != -1) {
    value = loadedValue;
  }

  geocache.numCoins = value;
  const coins: Coin[] = new Array<Coin>(value);

  // fills array with unique coins
  for (let n = 0; n < coins.length; n++) {
    coins[n] = { i: cellI, j: cellJ, serial: n };
  }

  updateMementos(geocache, value);
  console.log(mementos);
  console.log(cellI, cellJ, loadedValue);

  geocacheRect.bindPopup(() => {
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at "${cellI},${cellJ}". It has value <span id="value">${coins.length}</span>.</div>
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;
    const collect = container.querySelector<HTMLButtonElement>("#collect")!;
    collect.addEventListener("click", () => {
      if (value > 0) {
        playerCoins.push(coins.pop()!);

        value--;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        points++;

        updateMementos(geocache, value);
        statusPanel.innerHTML = `${points} points accumulated`;
      }
    });
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (points > 0) {
        coins.push(playerCoins.pop()!);

        value++;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        points--;

        updateMementos(geocache, value);
        statusPanel.innerHTML = `${points} points accumulated`;
      }
    });
    return container;
  });
  geocacheRect.addTo(map);
}

playerMarker = moveMarker(playerMarker, PLAYER_LOCATION);
centerMapAround(playerMarker.getLatLng());

generateNeighborhood(PLAYER_LOCATION);

// additional functions

function moveMarker(
  marker: leaflet.Marker,
  location: leaflet.LatLng
): leaflet.Marker {
  return marker.setLatLng(location);
}

function centerMapAround(location: leaflet.LatLng) {
  map.setView(location);
}

function removeAllPits() {
  tiles.forEach((tile) => {
    tile.remove();
  });
}

function generateNeighborhood(center: leaflet.LatLng) {
  removeAllPits();
  const { i, j } = board.getCellForPoint(center);
  for (let cellI = -NEIGHBORHOOD_SIZE; cellI < NEIGHBORHOOD_SIZE; cellI++) {
    for (let cellJ = -NEIGHBORHOOD_SIZE; cellJ < NEIGHBORHOOD_SIZE; cellJ++) {
      if (luck([i + cellI, j + cellJ].toString()) < PIT_SPAWN_PROBABILITY) {
        makeGeocache(i + cellI, j + cellJ);
      }
    }
  }
}

function updateMementos(geocache: Geocache, value: number) {
  geocache.numCoins = value;
  const key = [geocache.i, geocache.j].toString();
  mementos.set(key, geocache.toMemento());
}

function loadFromMementos(geocache: Geocache): number {
  const key = [geocache.i, geocache.j].toString();
  if (mementos.has(key)) {
    geocache.fromMemento(mementos.get(key)!);
    return geocache.numCoins;
  }
  return -1;
}
