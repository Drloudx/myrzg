import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { overlayStack } from '../../utils/overlayStack.js'
import { createNativeBackHandler } from '../../utils/nativeBackHandler.js'

export function useNativeShell() {
  const isDarkMode = ref(false)
  let backHandler = null
  let stopBackWatch = null
  const handleEscape = event => {
    if (event.key === 'Escape' && !event.isComposing && overlayStack.dismissTopOverlay()) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const syncStatusBar = async dark => {
    if (!Capacitor.isNativePlatform()) return
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    } catch (error) {
      console.warn('Native status bar sync skipped:', error)
    }
  }

  const applyTheme = dark => {
    isDarkMode.value = dark
    document.documentElement.classList.toggle('dark-mode', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    syncStatusBar(dark)
  }

  const toggleDarkMode = () => applyTheme(!isDarkMode.value)

  onMounted(() => {
    applyTheme(localStorage.getItem('theme') === 'dark')
    document.addEventListener('keydown', handleEscape)
    if (!Capacitor.isNativePlatform()) return
    backHandler = createNativeBackHandler(CapApp, overlayStack.dismissTopOverlay,
      error => console.warn('Native back button listener skipped:', error))
    stopBackWatch = watch(overlayStack.hasActiveOverlay, active => backHandler.setActive(active),
      { immediate: true, flush: 'sync' })
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape)
    stopBackWatch?.()
    backHandler?.dispose()
  })

  return { isDarkMode, toggleDarkMode }
}
