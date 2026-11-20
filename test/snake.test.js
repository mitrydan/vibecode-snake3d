import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame, DIRECTIONS } from '../src/game.js';

test('Snake moves forward and grows when eating food', () => {
  const game = new SnakeGame(10);
  const initialLength = game.snake.length;
  const initialHead = { ...game.snake[0] };

  // Place food directly in front of snake
  game.food = { x: initialHead.x, z: initialHead.y ? initialHead.y : initialHead.z - 1 };

  const result = game.step();
  assert.equal(result, 'eat');
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, initialLength + 1);
  assert.equal(game.snake[0].z, initialHead.z - 1);
});

test('Snake dies on wall collision', () => {
  const game = new SnakeGame(6);
  // Head at (3, 3), move up until wall at z = 0 then out of bounds
  game.snake = [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 3, z: 2 }];
  game.direction = DIRECTIONS.UP;
  game.nextDirection = DIRECTIONS.UP;

  const result = game.step();
  assert.equal(result, false);
  assert.equal(game.gameOver, true);
});

test('Snake prevents immediate 180 degree turn', () => {
  const game = new SnakeGame(10);
  game.direction = DIRECTIONS.UP;
  const changed = game.setDirection(DIRECTIONS.DOWN);
  assert.equal(changed, false);
  assert.equal(game.nextDirection, DIRECTIONS.UP);
});

test('Snake accumulates score and grows with multiple foods', () => {
  const game = new SnakeGame(15);
  // Eat 3 foods in a row
  for (let i = 0; i < 3; i++) {
    const head = game.snake[0];
    game.food = { x: head.x, z: head.z - 1 };
    game.direction = DIRECTIONS.UP;
    game.nextDirection = DIRECTIONS.UP;
    const res = game.step();
    assert.equal(res, 'eat');
  }
  assert.equal(game.score, 30);
  assert.equal(game.snake.length, 6);
});

test('Snake relative turns (turnLeft and turnRight)', () => {
  const game = new SnakeGame(10);
  // Initially facing UP (0, -1)
  assert.deepEqual(game.nextDirection, DIRECTIONS.UP);

  // Turn Left from UP -> should face LEFT (-1, 0)
  game.turnLeft();
  assert.deepEqual(game.nextDirection, DIRECTIONS.LEFT);
  game.direction = game.nextDirection;

  // Turn Left from LEFT -> should face DOWN (0, 1)
  game.turnLeft();
  assert.deepEqual(game.nextDirection, DIRECTIONS.DOWN);
  game.direction = game.nextDirection;

  // Turn Right from DOWN -> should face LEFT (-1, 0)
  game.turnRight();
  assert.deepEqual(game.nextDirection, DIRECTIONS.LEFT);
  game.direction = game.nextDirection;

  // Turn Right from LEFT -> should face UP (0, -1)
  game.turnRight();
  assert.deepEqual(game.nextDirection, DIRECTIONS.UP);
});

test('2-Player mode: separate controls and winner detection', () => {
  const game = new SnakeGame(20, '2p');
  assert.equal(game.snakes.length, 2);

  // Player 1 controls (WASD)
  game.setDirection(DIRECTIONS.RIGHT, 0);
  // Player 2 controls (Arrows)
  game.setDirection(DIRECTIONS.LEFT, 1);

  assert.deepEqual(game.nextDirections[0], DIRECTIONS.RIGHT);
  assert.deepEqual(game.nextDirections[1], DIRECTIONS.LEFT);

  // Test collision: place P1 next to wall at (0, 5) heading LEFT
  game.snakes[0] = [{ x: 0, z: 5 }, { x: 1, z: 5 }, { x: 2, z: 5 }];
  game.setDirection(DIRECTIONS.LEFT, 0);
  game.snakes[1] = [{ x: 10, z: 10 }, { x: 10, z: 11 }, { x: 10, z: 12 }];
  game.setDirection(DIRECTIONS.UP, 1);

  const res = game.step();
  assert.equal(res, false);
  assert.equal(game.gameOver, true);
  assert.equal(game.winner, 'p2'); // P1 crashed into wall, P2 wins
});

test('2-Player mode: head to head collision causes draw', () => {
  const game = new SnakeGame(20, '2p');
  // Position heads one step apart moving toward each other
  game.snakes[0] = [{ x: 5, z: 10 }];
  game.snakes[1] = [{ x: 7, z: 10 }];
  game.setDirection(DIRECTIONS.RIGHT, 0);
  game.setDirection(DIRECTIONS.LEFT, 1);

  const res = game.step();
  assert.equal(res, false);
  assert.equal(game.gameOver, true);
  assert.equal(game.winner, 'draw');
});
