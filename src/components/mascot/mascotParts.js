// Imported source makes Vite invalidate the rig when artwork changes, including during HMR.
// Only repository-owned SVG is accepted here. Shared parts keep the face/clothes identical in every scene.
export function createMascotParts(model) {
  const svg = new DOMParser().parseFromString(model.source, 'image/svg+xml')
  const parts = {}
  for (const name of model.parts) {
    const element = svg.querySelector(`[${model.partAttribute}="${name}"]`).cloneNode(true)
    if (name === 'torso') element.querySelectorAll('.pose-idle-arm, .hil-original-arm, .hil-original-shoulder').forEach(arm => arm.remove())
    if (name === 'head') {
      const eyes = element.querySelector('.idle-eyes')
      const pupils = svg.createElementNS('http://www.w3.org/2000/svg', 'g')
      pupils.setAttribute('class', 'hil-pupils')
      for (const node of eyes.querySelectorAll(model.pupilColors.map(color => `[fill="${color}"]`).join(','))) pupils.appendChild(node)
      eyes.insertBefore(pupils, eyes.lastElementChild)
    }
    // Outer groups belong to the live rig; content retains the original paths and eye animation.
    parts[name] = model.artOffset ? `<g transform="translate(${model.artOffset} 0)">${element.innerHTML}</g>` : element.innerHTML
  }
  // Costume details are authored in the relevant joint's local coordinates.
  // Optional for the original seven; clothing stays attached through every pose.
  for (const joint of ['upperArm', 'cuff', 'thigh', 'shin', 'boot']) {
    for (const name of [joint, `${joint}-left`, `${joint}-right`]) {
      const element = svg.querySelector(`[${model.partAttribute}="${name}"]`)
      if (element) parts[name] = element.innerHTML
    }
  }
  return parts
}
