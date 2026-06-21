import { createChart } from 'lightweight-charts';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="chart"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

try {
  const container = dom.window.document.getElementById('chart');
  const chart = createChart(container, { width: 400, height: 300 });
  console.log("Chart methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(chart)));
} catch (err) {
  console.error("Error creating chart:", err);
}
