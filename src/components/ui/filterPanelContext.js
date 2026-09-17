export const filterPanelKey = Symbol('filter-panel')

let nextPanelId = 0
export const createFilterPanelId = () => `ui-filter-content-${++nextPanelId}`
