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

const PLAYER_LOCATION = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

/*const NULL_ISLAND = leaflet.latLng({
    lat: 0,
    lng: 0
});*/

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
// const DEGREE_TO_ROUND = 4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const mapContainer = document.querySelector<HTMLElement>("#map")!;

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

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function makePit(i: number, j: number) {
  const cell: Cell = { i, j };
  const bounds = board.getCellBounds(cell);
  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  pit.bindPopup(() => {
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    const coins: Coin[] = new Array<Coin>(value);

      const cellI = i * TILE_DEGREES;
      const cellJ = j * TILE_DEGREES;

    // fills array with unique coins
    for (let n = 0; n < coins.length; n++) {
      coins[n] = { i: cellI, j: cellJ, serial: n };
    }

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
        statusPanel.innerHTML = `${points} points accumulated`;
      }
    });
    return container;
  });
  pit.addTo(map);
}

playerMarker = moveMarker(playerMarker, PLAYER_LOCATION);
centerMapAround(playerMarker.getLatLng());

generateNeighborhood(PLAYER_LOCATION);

// additional functions

function moveMarker(marker: leaflet.Marker, location: leaflet.LatLng): leaflet.Marker {
    return marker.setLatLng(location);
}

function centerMapAround(location: leaflet.LatLng) {
    map.setView(location);
}

function removeAllPits() {
    //
}

function generateNeighborhood(center: leaflet.LatLng) {
    removeAllPits();
    const { i, j } = board.getCellForPoint(center);
    for (let cellI = -NEIGHBORHOOD_SIZE; cellI < NEIGHBORHOOD_SIZE; cellI++) {
        for (let cellJ = -NEIGHBORHOOD_SIZE; cellJ < NEIGHBORHOOD_SIZE; cellJ++) {
            if (luck([i + cellI, j + cellJ].toString()) < PIT_SPAWN_PROBABILITY) {
                makePit(i, j);
            }
        }
    }
}
