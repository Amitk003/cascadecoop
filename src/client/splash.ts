import { context, requestExpandedMode } from '@devvit/web/client';

const titleElement = document.getElementById('title') as HTMLHeadingElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

function init() {
  const user = context.username ?? 'Redditor';
  titleElement.textContent = `Hey ${user}`;
}

init();
