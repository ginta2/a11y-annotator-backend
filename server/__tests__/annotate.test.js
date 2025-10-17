// server/__tests__/annotate.test.js
import request from 'supertest';
import { app } from '../server.js';

test('returns empty-state when no focusables', async () => {
  const payload = { 
    platform: 'web', 
    frame: { 
      id: '1', 
      name: 'Empty', 
      tree: { 
        name: 'Empty', 
        type: 'FRAME', 
        visible: true, 
        focusable: false, 
        children: [] 
      } 
    } 
  };
  const res = await request(app).post('/annotate').send(payload);
  expect(res.body.ok).toBe(true);
  expect(res.body.items.length).toBe(0);
  expect(res.body.message).toBe('No focusable elements in this selection.');
});

test('trivial frame bypasses LLM', async () => {
  const tree = { 
    name: 'Header', 
    type: 'FRAME', 
    visible: true, 
    focusable: false, 
    children: [
      { name: 'Back', type: 'TEXT', visible: true, role: 'link', focusable: true },
      { name: 'Swap', type: 'FRAME', visible: true, role: 'button', focusable: true }
    ]
  };
  const res = await request(app).post('/annotate').send({ 
    platform: 'web', 
    frame: { id: '2', name: 'Header', tree } 
  });
  expect(res.body.ok).toBe(true);
  expect(res.body.items.length).toBe(2);
  expect(res.body.items[0].label).toBe('Back');
  expect(res.body.items[0].role).toBe('link');
  expect(res.body.items[1].label).toBe('Swap');
  expect(res.body.items[1].role).toBe('button');
});

test('handles legacy frames array format', async () => {
  const payload = {
    platform: 'web',
    frames: [{
      id: '3',
      name: 'Legacy',
      tree: {
        name: 'Legacy',
        type: 'FRAME',
        visible: true,
        focusable: false,
        children: [
          { name: 'Button', type: 'TEXT', visible: true, role: 'button', focusable: true }
        ]
      }
    }]
  };
  const res = await request(app).post('/annotate').send(payload);
  expect(res.body.ok).toBe(true);
  expect(res.body.items.length).toBe(1);
  expect(res.body.items[0].label).toBe('Button');
});

test('returns error for bad request', async () => {
  const res = await request(app).post('/annotate').send({});
  expect(res.status).toBe(400);
  expect(res.body.ok).toBe(false);
  expect(res.body.error).toBe('bad_request');
});

test('health endpoint works', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});
