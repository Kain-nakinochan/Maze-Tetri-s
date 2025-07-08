let cols = 20;
let rows = 20;
let cellSize = 20;

let grid = [];
let current;
let stack = [];

let player;
let goal;

let lastMoveTime = 0;
const moveCooldown = 100;

let stage = 1;
let visitedTrail = new Set();

let blocks = []; // テトリス風ブロック管理
let blockSpawnInterval = 3000; // 新ブロックの生成間隔(ms)
let lastBlockTime = 0;

// ==== p5.js ====

function setup() {
  let canvas = createCanvas(cols * cellSize, rows * cellSize);
  canvas.parent("container");  // ここでcanvasをdiv#containerに追加
  frameRate(60);
  generateMaze();
  player = { i: 0, j: 0 };
  goal = { i: cols - 1, j: rows - 1 };
  visitedTrail.clear();
  markVisited(player.i, player.j);
  spawnBlock();
}

function draw() {
  background(255);
  drawTrail();

  // ブロックの処理
  updateBlocks();

  for (let cell of grid) {
    cell.show();
  }

  // プレイヤー
  fill(0, 0, 255);
  noStroke();
  ellipse(player.i * cellSize + cellSize / 2, player.j * cellSize + cellSize / 2, cellSize * 0.5);

  // ゴール
  fill(255, 0, 0);
  rect(goal.i * cellSize + cellSize * 0.25, goal.j * cellSize + cellSize * 0.25, cellSize * 0.5, cellSize * 0.5);

  // 移動処理
  let now = millis();
  if (now - lastMoveTime > moveCooldown) {
    let index = indexFrom(player.i, player.j);
    let cell = grid[index];

    if ((keyIsDown(UP_ARROW) || keyIsDown(87)) && !cell.walls[0]) {
      player.j--;
      lastMoveTime = now;
    } else if ((keyIsDown(DOWN_ARROW) || keyIsDown(83)) && !cell.walls[2]) {
      player.j++;
      lastMoveTime = now;
    } else if ((keyIsDown(LEFT_ARROW) || keyIsDown(65)) && !cell.walls[3]) {
      player.i--;
      lastMoveTime = now;
    } else if ((keyIsDown(RIGHT_ARROW) || keyIsDown(68)) && !cell.walls[1]) {
      player.i++;
      lastMoveTime = now;
    }

    player.i = constrain(player.i, 0, cols - 1);
    player.j = constrain(player.j, 0, rows - 1);
    markVisited(player.i, player.j);
  }

  // ゴールしたら次ステージへ
  if (player.i === goal.i && player.j === goal.j) {
    stage++;
    cols = min(80, cols + 5);
    rows = min(80, rows + 5);
    cellSize = floor(min(600 / cols, 600 / rows));
    resizeCanvas(cols * cellSize, rows * cellSize);
    generateMaze();
    player = { i: 0, j: 0 };
    goal = { i: cols - 1, j: rows - 1 };
    visitedTrail.clear();
    markVisited(player.i, player.j);
    blocks = [];
    spawnBlock();
  }

  // ステージ表示
  fill(0);
  noStroke();
  textSize(14);
  text(`Stage: ${stage}`, 10, height - 20);
}

// ==== 軌跡描画・記録 ====

function markVisited(i, j) {
  visitedTrail.add(`${i},${j}`);
}

function drawTrail() {
  noStroke();
  fill(100, 100, 255, 50);
  for (let pos of visitedTrail) {
    let [i, j] = pos.split(',').map(Number);
    rect(i * cellSize, j * cellSize, cellSize, cellSize);
  }
}

// ==== ブロック関係 ====

function spawnBlock() {
  let shape = random([
    [[0, 0]], // 1マス
    [[0, 0], [1, 0]], // 横2マス
    [[0, 0], [0, 1]], // 縦2マス
    [[0, 0], [1, 0], [0, 1]], // L字
    [[0, 0], [1, 0], [1, 1]], // 逆L字
  ]);
  let x = floor(random(cols - 2));
  blocks.push(new Block(x, 0, shape));
}

function updateBlocks() {
  let now = millis();

  for (let block of blocks) {
    block.update();
    block.show();

    if (block.hits(player.i, player.j)) {
      player = { i: 0, j: 0 }; // リセット
      visitedTrail.clear();
      markVisited(player.i, player.j);
    }
  }

  // ブロック削除（画面外）
  blocks = blocks.filter(b => b.y < rows);

  if (now - lastBlockTime > blockSpawnInterval) {
    spawnBlock();
    lastBlockTime = now;
  }
}

class Block {
  constructor(x, y, shape) {
    this.x = x;
    this.y = y;
    this.shape = shape; // 相対座標の配列
    this.fallSpeed = 0.02; // ブロックの落下速度（1フレームで何マス落ちるか）
    this.offset = 0;
  }

  update() {
    this.offset += this.fallSpeed;
    if (this.offset >= 1) {
      this.y++;
      this.offset = 0;
    }
  }

  show() {
    fill(50);
    noStroke();
    for (let [dx, dy] of this.shape) {
      let px = (this.x + dx) * cellSize;
      let py = (this.y + dy) * cellSize;
      rect(px, py, cellSize, cellSize);
    }
  }

  hits(px, py) {
    for (let [dx, dy] of this.shape) {
      if (this.x + dx === px && this.y + dy === py) {
        return true;
      }
    }
    return false;
  }
}

// ==== 迷路生成関係 ====

function generateMaze() {
  grid = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grid.push(new Cell(i, j));
    }
  }
  current = grid[0];
  stack = [];

  while (true) {
    current.visited = true;
    let next = current.checkNeighbors();
    if (next) {
      next.visited = true;
      stack.push(current);
      removeWalls(current, next);
      current = next;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      break;
    }
  }
}

function indexFrom(i, j) {
  if (i < 0 || j < 0 || i >= cols || j >= rows) return -1;
  return i + j * cols;
}

class Cell {
  constructor(i, j) {
    this.i = i;
    this.j = j;
    this.walls = [true, true, true, true];
    this.visited = false;
  }

  checkNeighbors() {
    let neighbors = [];

    let top = grid[indexFrom(this.i, this.j - 1)];
    let right = grid[indexFrom(this.i + 1, this.j)];
    let bottom = grid[indexFrom(this.i, this.j + 1)];
    let left = grid[indexFrom(this.i - 1, this.j)];

    if (top && !top.visited) neighbors.push(top);
    if (right && !right.visited) neighbors.push(right);
    if (bottom && !bottom.visited) neighbors.push(bottom);
    if (left && !left.visited) neighbors.push(left);

    if (neighbors.length > 0) {
      let r = floor(random(neighbors.length));
      return neighbors[r];
    } else {
      return undefined;
    }
  }

  show() {
    let x = this.i * cellSize;
    let y = this.j * cellSize;
    stroke(0);
    if (this.walls[0]) line(x, y, x + cellSize, y);
    if (this.walls[1]) line(x + cellSize, y, x + cellSize, y + cellSize);
    if (this.walls[2]) line(x + cellSize, y + cellSize, x, y + cellSize);
    if (this.walls[3]) line(x, y + cellSize, x, y);
  }
}

function removeWalls(a, b) {
  let dx = a.i - b.i;
  let dy = a.j - b.j;

  if (dx === 1) {
    a.walls[3] = false;
    b.walls[1] = false;
  } else if (dx === -1) {
    a.walls[1] = false;
    b.walls[3] = false;
  }

  if (dy === 1) {
    a.walls[0] = false;
    b.walls[2] = false;
  } else if (dy === -1) {
    a.walls[2] = false;
    b.walls[0] = false;
  }
}
