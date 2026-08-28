import os
import tkinter as tk
from tkinter import filedialog

# 配置：True=只预览不删除，False=真实删除文件
PREVIEW_ONLY = False

def delete_hash_images():
    # 隐藏tk主窗口
    root = tk.Tk()
    root.withdraw()

    # 弹出文件夹选择框
    folder_path = filedialog.askdirectory(title="选择图片所在文件夹")
    if not folder_path:
        print("未选择文件夹，程序退出")
        return

    img_ext = (".png", ".jpg", ".jpeg", ".gif", ".webp")
    to_remove = []

    # 遍历文件筛选带#的图片
    for filename in os.listdir(folder_path):
        full_name = filename.lower()
        if "#" in filename and full_name.endswith(img_ext):
            to_remove.append(filename)

    if not to_remove:
        print("该目录下没有带#的图片文件")
        return

    print(f"共找到 {len(to_remove)} 个待删除文件：")
    for name in to_remove:
        print(f" - {name}")

    if PREVIEW_ONLY:
        print("\n【预览模式】未执行删除，确认无误后将 PREVIEW_ONLY 改为 False 再运行")
        return

    # 执行删除
    success = 0
    fail = 0
    for name in to_remove:
        file_full_path = os.path.join(folder_path, name)
        try:
            os.remove(file_full_path)
            success += 1
        except Exception as e:
            print(f"删除失败 {name}：{str(e)}")
            fail += 1
    print(f"\n操作完成：成功删除 {success} 个，失败 {fail} 个")

if __name__ == "__main__":
    delete_hash_images()
    input("\n按回车键关闭窗口")