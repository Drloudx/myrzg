// Palette slots used by the shared limb drawings, from each reference costume.
export const costume = (sleeve, skin, cuff, thigh, stocking, boot, trim) => ({
  '--rig-sleeve': sleeve, '--rig-fold': cuff, '--rig-cuff': cuff,
  '--rig-glove': skin, '--rig-thumb': skin, '--rig-trim': trim,
  '--rig-thigh': thigh, '--rig-stocking': stocking, '--rig-knee-trim': trim,
  '--rig-leg-fold': stocking, '--rig-boot': boot, '--rig-boot-trim': trim, '--rig-sole': '#514b48'
})
