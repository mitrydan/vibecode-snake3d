export const DIRECTIONS = {
  UP: { x: 0, z: -1 },
  DOWN: { x: 0, z: 1 },
  LEFT: { x: -1, z: 0 },
  RIGHT: { x: 1, z: 0 }
};

export class SnakeGame {
  constructor(gridSize = 20, mode = '1p') {
    this.gridSize = gridSize;
    this.mode = mode; // '1p' or '2p'
    this.reset();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  reset() {
    this.isPaused = false;
    this.gameOver = false;
    this.winner = null; // 'p1' | 'p2' | 'draw' | null

    const midZ = Math.floor(this.gridSize / 2);

    if (this.mode === '2p') {
      const p1X = 5;
      const p2X = this.gridSize - 6;

      this.snakes = [
        [
          { x: p1X, z: midZ },
          { x: p1X, z: midZ + 1 },
          { x: p1X, z: midZ + 2 }
        ],
        [
          { x: p2X, z: midZ },
          { x: p2X, z: midZ + 1 },
          { x: p2X, z: midZ + 2 }
        ]
      ];
      this.directions = [DIRECTIONS.UP, DIRECTIONS.UP];
      this.nextDirections = [DIRECTIONS.UP, DIRECTIONS.UP];
      this.scores = [0, 0];
      this.foods = [];
      const f1 = this.spawnFood();
      if (f1) this.foods.push(f1);
      const f2 = this.spawnFood();
      if (f2) this.foods.push(f2);
    } else {
      const midX = Math.floor(this.gridSize / 2);
      this.snakes = [
        [
          { x: midX, z: midZ },
          { x: midX, z: midZ + 1 },
          { x: midX, z: midZ + 2 }
        ]
      ];
      this.directions = [DIRECTIONS.UP];
      this.nextDirections = [DIRECTIONS.UP];
      this.scores = [0];
      this.foods = [];
      const f = this.spawnFood();
      if (f) this.foods.push(f);
    }
  }

  // Backwards compatibility getters for 1P callers
  get snake() { return this.snakes[0]; }
  set snake(val) { this.snakes[0] = val; }
  get score() { return this.scores[0]; }
  set score(val) { this.scores[0] = val; }
  get direction() { return this.directions[0]; }
  set direction(val) { this.directions[0] = val; }
  get nextDirection() { return this.nextDirections[0]; }
  set nextDirection(val) { this.nextDirections[0] = val; }
  get food() { return this.foods[0] || null; }
  set food(val) { this.foods = val ? [val] : []; }

  setDirection(newDir, playerIndex = 0) {
    if (!this.snakes[playerIndex]) return false;
    const cur = this.directions[playerIndex];
    if (cur.x + newDir.x === 0 && cur.z + newDir.z === 0) {
      return false; // Prevent 180-degree reversal
    }
    this.nextDirections[playerIndex] = newDir;
    return true;
  }

  turnLeft(playerIndex = 0) {
    const cur = this.nextDirections[playerIndex];
    return this.setDirection({ x: cur.z || 0, z: -cur.x || 0 }, playerIndex);
  }

  turnRight(playerIndex = 0) {
    const cur = this.nextDirections[playerIndex];
    return this.setDirection({ x: -cur.z || 0, z: cur.x || 0 }, playerIndex);
  }

  spawnFood() {
    const occupied = new Set();
    for (const s of this.snakes) {
      for (const seg of s) {
        occupied.add(`${seg.x},${seg.z}`);
      }
    }
    for (const f of this.foods) {
      occupied.add(`${f.x},${f.z}`);
    }

    const emptyCells = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const key = `${x},${z}`;
        if (!occupied.has(key)) {
          emptyCells.push({ x, z });
        }
      }
    }

    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  step() {
    if (this.gameOver || this.isPaused) return false;

    const numPlayers = this.snakes.length;
    for (let i = 0; i < numPlayers; i++) {
      this.directions[i] = this.nextDirections[i];
    }

    const newHeads = [];
    const wallCrashes = [];

    for (let i = 0; i < numPlayers; i++) {
      const head = this.snakes[i][0];
      const dir = this.directions[i];
      const nh = { x: head.x + dir.x, z: head.z + dir.z };
      newHeads.push(nh);

      const hitWall = nh.x < 0 || nh.x >= this.gridSize || nh.z < 0 || nh.z >= this.gridSize;
      wallCrashes.push(hitWall);
    }

    // Check which foods are eaten
    const eatenFoodIndices = [];
    const playerAteFood = new Array(numPlayers).fill(false);

    for (let p = 0; p < numPlayers; p++) {
      const nh = newHeads[p];
      for (let fIdx = 0; fIdx < this.foods.length; fIdx++) {
        const food = this.foods[fIdx];
        if (food && nh.x === food.x && nh.z === food.z) {
          playerAteFood[p] = true;
          if (!eatenFoodIndices.includes(fIdx)) {
            eatenFoodIndices.push(fIdx);
          }
        }
      }
    }

    // Body collisions
    const bodyCrashes = new Array(numPlayers).fill(false);
    let headToHead = false;

    if (numPlayers === 2) {
      if (newHeads[0].x === newHeads[1].x && newHeads[0].z === newHeads[1].z) {
        headToHead = true;
      }
    }

    for (let p = 0; p < numPlayers; p++) {
      const nh = newHeads[p];

      for (let other = 0; other < numPlayers; other++) {
        const otherSnake = this.snakes[other];
        const otherEats = playerAteFood[other];
        const bodyToCheck = otherEats ? otherSnake : otherSnake.slice(0, -1);

        if (bodyToCheck.some(seg => seg.x === nh.x && seg.z === nh.z)) {
          bodyCrashes[p] = true;
        }
      }
    }

    const crashed = [];
    for (let p = 0; p < numPlayers; p++) {
      crashed.push(wallCrashes[p] || bodyCrashes[p] || headToHead);
    }

    if (numPlayers === 1) {
      if (crashed[0]) {
        this.gameOver = true;
        return false;
      }

      this.snakes[0].unshift(newHeads[0]);
      if (playerAteFood[0]) {
        this.scores[0] += 10;
        this.foods = this.foods.filter((_, idx) => !eatenFoodIndices.includes(idx));
        const newF = this.spawnFood();
        if (newF) this.foods.push(newF);
        return 'eat';
      } else {
        this.snakes[0].pop();
        return 'move';
      }
    } else {
      // 2 Players mode
      if (crashed[0] && crashed[1]) {
        this.gameOver = true;
        this.winner = 'draw';
        return false;
      } else if (crashed[0]) {
        this.gameOver = true;
        this.winner = 'p2';
        return false;
      } else if (crashed[1]) {
        this.gameOver = true;
        this.winner = 'p1';
        return false;
      }

      // Both survived
      for (let p = 0; p < 2; p++) {
        this.snakes[p].unshift(newHeads[p]);
        if (playerAteFood[p]) {
          this.scores[p] += 10;
        } else {
          this.snakes[p].pop();
        }
      }

      // Respawn foods
      if (eatenFoodIndices.length > 0) {
        this.foods = this.foods.filter((_, idx) => !eatenFoodIndices.includes(idx));
        for (let k = 0; k < eatenFoodIndices.length; k++) {
          const newF = this.spawnFood();
          if (newF) this.foods.push(newF);
        }
      }

      return {
        p1: playerAteFood[0] ? 'eat' : 'move',
        p2: playerAteFood[1] ? 'eat' : 'move',
        p1Head: newHeads[0],
        p2Head: newHeads[1]
      };
    }
  }

  togglePause() {
    if (!this.gameOver) {
      this.isPaused = !this.isPaused;
    }
    return this.isPaused;
  }
}
