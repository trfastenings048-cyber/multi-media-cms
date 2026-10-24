const back = document.getElementById('back')
back.addEventListener('click', () => window.playerNavigation.back())
window.playerNavigation.onState((enabled) => { back.disabled = !enabled })
