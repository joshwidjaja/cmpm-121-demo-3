import leaflet, { LatLngBounds } from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }

    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    return this.getCanonicalCell({
      i: i,
      j: j,
    });
  }

  getCellBounds(cell: Cell): LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i * this.tileWidth, cell.j * this.tileWidth],
      [(cell.i + 1) * this.tileWidth, (cell.j + 1) * this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);

    for (const key in this.knownCells) {
      const cell: Cell = this.knownCells.get(key)!;

      if (this.isWithinRadius(originCell, cell)) {
        resultCells.push(cell);
      }
    }
    return resultCells;
  }

  isWithinRadius(cell: Cell, other: Cell): boolean {
    return (
      Math.abs(cell.i - other.i) <= this.tileVisibilityRadius &&
      Math.abs(cell.j - other.j) <= this.tileVisibilityRadius
    );
  }
}
