import os
import json
import re
from collections import defaultdict
from pygapbide import *
# from prefixspan import PrefixSpan
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import CountVectorizer
# from sklearn.feature_extraction.text import TfidfVectorizer
# from pymining import seqmining
# from collections import Counter

# 1. 加载操作文件
def parse_operation_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    operations = [op.split('-')[0] for op in content.split(';') if op]  # 只保留 MUT_XXX
    # print(operations)
    return operations

def load_all_sequences(folder, layer_arr):
    print("加载操作文件......")
    sequences = []
    filenames = []
    for file in os.listdir(folder):
        m = re.match(r'^(.*?)time', file)
        arr = m.group(1).split(',')
        numbers1 = re.findall(r'\d+', arr[0])
        if numbers1[0] == '000000':
            fid = '0'
        else:
            fid = re.search(r'([1-9]\d*)0*$', arr[0])
            fid = fid.group(1) if fid else arr[0]
        
        if file.endswith(".txt") and fid in layer_arr: # 假设后缀为 .txt，可修改
            full_path = os.path.join(folder, file)
            sequences.append(parse_operation_file(full_path))
            filenames.append(file)
            # print(sequences)
    # print("当前层: ", len(sequences))
    return sequences, filenames

# 4. KMeans 聚类
def perform_kmeans(vectors, n_clusters=5):
    print("KMeans 聚类......")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(vectors)
    return labels

def traverse(node, level):
    name = node.get("name")

    # 去重：如果这个节点第一次出现，则加入对应层级
    if name not in seen:
        layers[level].append(name)
        seen.add(name)

    # 递归遍历子节点
    for child in node.get("children", []):
        traverse(child, level + 1)

def get_optimal_gapbide_params(sequences):
    """
    为Gap-Bide高速优化的参数调整函数，大幅减少pattern输出数量。
    参数调整目标：
    - 大幅提高支持度要求，显著减少pattern数量
    - 显著缩减gap范围，降低搜索复杂度  
    - 优先挖掘最具代表性的高频模式，提高运行速度
    """
    seq_count = len(sequences)
    # 如果序列总数小于10，直接跳过以提高速度
    if seq_count < 10:
        print(f"序列数量 {seq_count} 小于10，跳过模式挖掘。")
        return seq_count + 1, 0, 3
    
    avg_length = sum(len(seq) for seq in sequences) / seq_count
    
    print(f"序列统计: 数量={seq_count}, 平均长度={avg_length:.1f}")
    
    # 大幅提高最小支持度要求，减少pattern数量
    min_sup = max(10, int(seq_count * 0.15))  # 至少10个序列支持，或总数的15%
    
    # 大幅提高支持度比例，只保留最频繁的模式
    if seq_count >= 2000:
        sup_ratio = 0.35  # 从0.15大幅提高到0.35
    elif seq_count >= 1000:
        sup_ratio = 0.40  # 从0.20大幅提高到0.40
    elif seq_count >= 500:
        sup_ratio = 0.45  # 从0.25大幅提高到0.45
    elif seq_count >= 200:
        sup_ratio = 0.50  # 从0.30大幅提高到0.50
    elif seq_count >= 100:
        sup_ratio = 0.55  # 从0.40大幅提高到0.55
    else:  # seq_count < 100
        sup_ratio = 0.60  # 从0.50大幅提高到0.60
        
    sup = max(min_sup, int(seq_count * sup_ratio))
    
    # 大幅缩减Gap范围(n)，显著减少搜索空间
    if avg_length >= 500:
        n = 1   # 从15大幅降到5
    elif avg_length >= 300:
        n = 1   # 从12大幅降到4
    elif avg_length >= 200:
        n = 1   # 从10大幅降到3
    elif avg_length >= 100:
        n = 1  # 从8大幅降到3
    else:
        n = 1   # 从10大幅降到3

    m = 0  # 允许相邻元素
    
    # 移除了原有的会降低支持度的特殊调整，以保证内存效率
    
    print(f"高速参数设置: sup={sup} ({sup/seq_count*100:.1f}%), m={m}, n={n}")
    print(f"预期: 大幅减少pattern数量，显著提高运行速度，保留最重要模式。")
    
    return sup, m, n

def get_efficient_params(sequences):
    """保持原函数名的兼容性"""
    return get_optimal_gapbide_params(sequences)


# 主程序执行流程
if __name__ == "__main__":
    result = []
    # 层级结构：每层的节点名列表
    layers = defaultdict(list)

    # 用于记录已经处理过的节点，防止重复
    seen = set()

    # 加载 JSON 文件
    with open(r"NodeTree/public/b.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    # 遍历根节点
    for root in data.get("nodes", []):
        traverse(root, 0)

    # 将 defaultdict 转为普通字典并输出
    layer_dict = dict(layers)
    

    folder_path = r"tmp"  # 相对路径：父文件夹下的tmp目录
    data = []
    # print(layer_dict[1])
    for i in range(len(layer_dict.keys())):
        result = []

        if i == 0:
            continue
        sequences, filenames = load_all_sequences(folder_path, layer_dict[i])

        # 把操作序列变成字符串：['MUT_DEL MUT_ARITH8 MUT_ARITH8', ...]
        corpus = [' '.join(seq) for seq in sequences]

        vectorizer = CountVectorizer()
        X = vectorizer.fit_transform(corpus)
        print(len(corpus))

        # 然后聚类
        n_clusters = min(5, len(corpus))
        if n_clusters > 0:
            labels = perform_kmeans(X, n_clusters=n_clusters)
        else:
            labels = []  # 空数据的情况
        # print(labels)
        label_dict = {}

        # 输出结果
        for file, label in zip(filenames, labels):

            m = re.match(r'^(.*?)time', file)
            arr = m.group(1).split(',')
            numbers1 = re.findall(r'\d+', arr[0])
            if numbers1[0] == '000000':
                fid = '0'
            else:
                fid = re.search(r'([1-9]\d*)0*$', arr[0])
                fid = fid.group(1) if fid else arr[0]

            if label in label_dict:
                label_dict[label].append(fid)
            else:
                label_dict.setdefault(label, [fid])

        # 补全到5类
        for j in range(5):
            if j not in label_dict:
                label_dict[j] = []

        # 确保顺序并转换为所需格式
        label_dict = {i: label_dict.get(i, []) for i in range(5)}
        data.append(label_dict)

        

        for j in range(len(list(label_dict.values()))):
            # print(j)
            result = []
            for k in range((len(list(label_dict.values())[j]))):
                result.append(sequences[k])

            # print(len(result))
            sup, m, n = get_efficient_params(result)
            print(f"l1_patterns数量: {len(result)}")
            g = Gapbide(result, sup, m, n)
            g.run()
    
        # print(len(corpus[0]))
    with open(r"NodeTree\public\merge.json", "w") as f:
        json.dump(data, f)
        
    # print(result)