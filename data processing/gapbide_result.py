import json
import os
from pathlib import Path

def process_gapbide_results():
    """
    处理gapbide_results文件夹中的数据，按照merge.json的格式输出结果
    """
    # 读取merge.json文件
    merge_file = r"NodeTree/public/merge.json"
    gapbide_dir = r"NodeTree/public/gapbide_results"
    
    try:
        with open(merge_file, 'r', encoding='utf-8') as f:
            merge_data = json.load(f)
            # print(merge_data)
    except FileNotFoundError:
        print(f"错误：找不到文件 {merge_file}")
        return
    except json.JSONDecodeError:
        print(f"错误：{merge_file} 不是有效的JSON文件")
        return
    
    # 检查gapbide_results目录是否存在
    if not os.path.exists(gapbide_dir):
        print(f"错误：找不到目录 {gapbide_dir}")
        return
    
    total_len = len(merge_data) * 5

    for i in range(len(merge_data)):
        for j in range(5):
            try:
                with open(gapbide_dir + "/patterns" + str(i*5 + j) + ".json" , 'r', encoding='utf-8') as f:
                    gapbide_data = json.load(f)
                # with open("NodeTree/public/processed_gapbide_results.json" , 'r', encoding='utf-8') as f:
                merge_data[i][str(j)] = gapbide_data
            except FileNotFoundError:
                merge_data[i][str(j)] = "NA"
                print(f"错误：找不到文件 {gapbide_dir + "/pattern" + str(i*5+j) + ".json"}")
    
    # 保存结果到新文件
    output_file = r"NodeTree/public/processed_gapbide_results.json"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(merge_data, f, ensure_ascii=False, indent=2)
        print(f"\n处理完成！结果已保存到 {output_file}")
    except Exception as e:
        print(f"保存文件时出错: {e}")

if __name__ == "__main__":
    process_gapbide_results()
