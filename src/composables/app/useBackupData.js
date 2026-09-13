import { ref } from 'vue'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isNative } from '../../utils/env.js'

export function useBackupData(showMessage) {
  const universalFileInput = ref(null)

  const handleExportData = async () => {
    try {
      const data = {
        timestamp: Date.now(),
        version: '1.0',
        type: 'myrzg_backup',
        data: { appState: JSON.parse(localStorage.getItem('appState') || '{}') }
      }
      const json = JSON.stringify(data)
      const fileName = `myrzg_backup_${Date.now()}.json`
      if (isNative) {
        const result = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
        await Share.share({ title: '导出深渊之歌数据', url: result.uri, dialogTitle: '保存或分享数据备份' })
        return
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出失败:', error)
      showMessage(`导出失败: ${error.message}`, '错误')
    }
  }

  const triggerUniversalImport = () => universalFileInput.value?.click()
  const handleUniversalImport = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = loadEvent => {
      try {
        const parsed = JSON.parse(loadEvent.target.result)
        if (parsed.type !== 'myrzg_backup') throw new Error('无效的备份文件')
        if (parsed.data?.appState) localStorage.setItem('appState', JSON.stringify(parsed.data.appState))
        showMessage('数据导入成功，即将刷新页面', '成功', () => location.reload())
      } catch (error) {
        showMessage(`导入失败: ${error.message}`, '错误')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return { universalFileInput, handleExportData, triggerUniversalImport, handleUniversalImport }
}
