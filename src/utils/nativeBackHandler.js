// Serialize asynchronous Capacitor listener changes, including close/unmount during registration.
export function createNativeBackHandler(app, dismiss, onError = console.warn) {
  let desired = false
  let disposed = false
  let listener = null
  let operation = Promise.resolve()

  const reconcile = () => {
    operation = operation.then(async () => {
      if (desired && !disposed && !listener) {
        listener = await app.addListener('backButton', () => {
          if (desired && !disposed) dismiss()
        })
      }
      if ((!desired || disposed) && listener) {
        const current = listener
        await current.remove()
        listener = null
      }
    }).catch(onError)
    return operation
  }

  return {
    setActive(active) {
      desired = !!active
      return reconcile()
    },
    dispose() {
      disposed = true
      desired = false
      return reconcile()
    }
  }
}
