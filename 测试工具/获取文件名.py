import os
from pathlib import Path
import tkinter as tk
from tkinter import filedialog

def select_folder_and_get_files():
    # 隐藏tk主窗口
    root = tk.Tk()
    root.withdraw()

    # 弹出文件夹选择窗口
    folder_path = filedialog.askdirectory(title="请选择资源文件夹")
    if not folder_path:
        print("未选择文件夹，程序退出")
        return

    print(f"选中文件夹：{folder_path}\n")
    folder = Path(folder_path)

    # 1. 仅当前文件夹内文件（不包含子文件夹）
    print("==== 当前文件夹内所有文件 ====")
    file_list = []
    for item in folder.iterdir():
        if item.is_file():
            file_list.append(item.name)
            print(item.name)

    # 2. 递归获取所有子文件夹全部文件（取消注释启用）
    # print("\n==== 包含所有子文件夹全部文件 ====")
    # all_file_list = []
    # for file in folder.rglob("*"):
    #     if file.is_file():
    #         all_file_list.append(file.name)
    #         print(file.name)

    # 返回文件名列表，后续可处理
    return file_list

if __name__ == "__main__":
    names = select_folder_and_get_files()
    print(f"\n文件总数：{len(names)}")
