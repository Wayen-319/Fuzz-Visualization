import os
import json
import re

def parse_filename(filename):
    """
    解析文件名，返回id和src
    文件名格式: id 000001,src 000000,time 34,execs 318,op inf,pos 0,+cov
    """
    m = re.match(r'^(.*?)time', filename)
    arr = m.group(1).split(',')
    

    if len(arr) == 3:
        return arr[0], arr[1]
    elif len(arr) == 2:
        return arr[0], '000000'
    elif len(arr) == 4:
        return arr[2], None
    return None

def parse_filename_(filename):
    """
    解析文件名，返回id和src
    文件名格式: id 000001,src 000000,time 34,execs 318,op inf,pos 0,+cov
    """
    m = re.match(r'^(.*?)time', filename)
    arr = m.group(1).split(',')

    return arr[0], arr[2]


def save_if_same(same_dict, same_dir, crash_dir):
    n = 0
    bug_list = {}
    for same_fname in os.listdir(same_dir):
        same_fpath = os.path.join(same_dir, same_fname)
        if not os.path.isfile(same_fpath):
            continue
        with open(same_fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    
        same_id, same_val = parse_filename_(same_fname)

        numbers_ = re.findall(r'\d+', same_id)
        if numbers_[0] == '000000':
            fid = '0'
        else:
            fid = re.search(r'([1-9]\d*)0*$', same_id)
            fid = fid.group(1) if fid else same_id

        numbers = re.findall(r'\d+', same_val)
        if numbers[0] == '000000':
            same_fsrc = '0'
        else:
            same_fsrc = re.search(r'([1-9]\d*)0*$', same_val)
            same_fsrc = same_fsrc.group(1) if same_fsrc else same_val

        pattern = r'#\d+.*? in (.+)'
        matches = re.findall(pattern, content)
        text = ""
        for match in matches:
            text = text + match + "\n"

        if text in bug_list:
            pass
        else:  
            bug_list.setdefault(text, "bug" + str(n))
            n = n + 1
        
        for crash in bug_list.values():
            if crash in same_dict:
                same_dict[crash].append("crash "+fid)
            else:
                same_dict.setdefault(crash, ["crash "+fid])

    # print(bug_list)
    # print(same_dict)
    
    with open(r"NodeTree/public/same.json", "w", encoding="utf-8") as f:
        json.dump(same_dict, f, ensure_ascii=False, indent=2)
    # for old_fname in os.listdir(crash_dir):
    #     m = re.match(r'^(.*?)time', old_fname)
    #     arr = m.group(1).split(',')
    #     if 
    #     new_name = arr[0] + "," + arr[1] + "," + arr[2]


def build_tree(queue_dir, crash_dir, hang_dir):
    """
    读取queue目录下所有文件，构建树结构
    """
    nodes = {}
    children_map = {}
    fid = ''
    crash_arr = []

    # 遍历queue目录下所有文件
    for queue_fname in os.listdir(queue_dir):
        crash_flag = False
        hang_flag = False

        queue_fpath = os.path.join(queue_dir, queue_fname)
        if not os.path.isfile(queue_fpath):
            continue
        id_val, src_val = parse_filename(queue_fname)
        with open(queue_fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 获取id_val最后不为0的几位
        # fid = re.search(r'([1-9]\d*)0*$', id_val)
        # fid = fid.group(1) if fid else id_val
        numbers1 = re.findall(r'\d+', id_val)
        if numbers1[0] == '000000':
            fid = '0'
        else:
            fid = re.search(r'([1-9]\d*)0*$', id_val)
            fid = fid.group(1) if fid else id_val

        numbers2 = re.findall(r'\d+', src_val)
        if numbers2[0] == '000000':
            fsrc = '0'
        else:
            fsrc = re.search(r'([1-9]\d*)0*$', src_val)
            fsrc = fsrc.group(1) if fsrc else src_val
        
        # 确定是否为crash
        for crash_fname in os.listdir(crash_dir):
            crash_val, _ = parse_filename(crash_fname)
            numbers3 = re.findall(r'\d+', crash_val)
            if numbers3[0] == '000000':
                crash_fsrc = '0'
            else:
                crash_fsrc = re.search(r'([1-9]\d*)0*$', crash_val)
                crash_fsrc = crash_fsrc.group(1) if crash_fsrc else crash_val

        # 确定是否为hang
        for hang_fname in os.listdir(hang_dir):
            _, hang_val = parse_filename(hang_fname)
            numbers4 = re.findall(r'\d+', hang_val)
            if numbers4[0] == '000000':
                hang_fsrc = '0'
            else:
                hang_fsrc = re.search(r'([1-9]\d*)0*$', hang_val)
                hang_fsrc = hang_fsrc.group(1) if hang_fsrc else hang_val
            # if fid < crash_fsrc:
            #     crash_flag = False
            #     continue
            # else:
            #     crash_fpath = os.path.join(crash_dir, crash_fname)
            #     with open(crash_fpath, 'r', encoding='utf-8', errors='ignore') as f:
            #         crash_content = f.read()
            #     # print("crash_content:\n", crash_content)
            #     # print("content:\n", content)
            #     # return 0
            #     if crash_content == content:
            #         crash_flag = True
            #         break
            #     else:
            #         crash_flag = False

        node = {
            "name": fid,
            "intro": content,
            "crash": crash_flag,
            "hang": hang_flag,
            "children": []
        }

        # fid = 1202
        nodes[fid] = node

        # 记录父子关系
        if fsrc not in children_map:
            children_map[fsrc] = []
        if fid == '0':
            continue
        children_map[fsrc].append(fid)

    

    # 确定是否为crash
    n = 0
    for crash_fname in os.listdir(crash_dir):
        # print(crash_fname)
        crash_val, _ = parse_filename(crash_fname)
        numbers3 = re.findall(r'\d+', crash_val)
        if numbers3[0] == '000000':
            crash_fsrc = '0'
        else:
            crash_fsrc = re.search(r'([1-9]\d*)0*$', crash_val)
            crash_fsrc = crash_fsrc.group(1) if crash_fsrc else crash_val

        crash_fpath = os.path.join(crash_dir, crash_fname)
        with open(crash_fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    crash_content = f.read()
        # print(nodes[crash_fsrc])
        nodes[crash_fsrc]["children"].append(
            {
                "name": f"crash {n}",
                "intro": crash_content,
                "crash": True,
                "hang": hang_flag,
                "children": []
            }
        )

        node = {
            "name": f"crash {n}",
            "intro": crash_content,
            "crash": True,
            "hang": hang_flag,
            "children": []
        }
        nodes[f"crash {n}"] = node

        n = n + 1
    
    # 确定是否为hang
    n = 0
    for hang_fname in os.listdir(hang_dir):
        _, hang_val = parse_filename(hang_fname)
        numbers4 = re.findall(r'\d+', hang_val)
        if numbers4[0] == '000000':
            hang_fsrc = '0'
        else:
            hang_fsrc = re.search(r'([1-9]\d*)0*$', hang_val)
            hang_fsrc = hang_fsrc.group(1) if hang_fsrc else hang_val
        
        hang_fpath = os.path.join(hang_dir, hang_fname)
        with open(hang_fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    hang_content = f.read()

        nodes[hang_fsrc]["children"].append(
            {
                "name": f"hang {n}",
                "intro": hang_content,
                "crash": crash_flag,
                "hang": True,
                "children": []
            }
        )

        node = {
            "name": f"hang {n}",
            "intro": hang_content,
            "crash": crash_flag,
            "hang": True,
            "children": []
        }
        nodes[f"hang {n}"] = node

        n = n + 1

    # 构建children
    for parent_id, child_ids in children_map.items():
        # print(parent_id, child_ids)
        if parent_id in nodes:
            nodes[parent_id]["children"].extend([nodes[cid] for cid in child_ids if cid in nodes])

    return nodes
            
# 2025.5.26 22：11 做到这里了，上面都改好了，src为000000的情况也写好了

    # # 找到根节点（src为000000且id不为000000）
    # root_candidates = [nid for nid in nodes if any(src == '000000' and nid == cid for src, cids in children_map.items() for cid in cids)]
    # # root_candidates = '0';

    # if not root_candidates:
    #     # fallback: 选id最小的
    #     root_id = min(nodes.keys())
    # else:
    #     root_id = root_candidates[0]
    # return nodes[root_id]

# def merge_nodes_by_group(nodes, group_dict):
#     """
#     合并节点分组。group_dict 是一个分组字典的列表，每个元素是 {group_id: [node_id, ...]}。
#     对每组，将 node_ids 对应的节点合并为一个新节点，并将原节点的父节点指向新节点，最后删除原节点。
#     注意：如果父节点不存在（如 KeyError: '543'），则跳过该父节点的children替换。
#     """
#     # 1. 记录每个节点的父节点
#     parent_map = {}
#     for node_id, node in nodes.items():
#         for child in node.get('children', []):
#             parent_map[child.get('name')] = node_id

#     # 2. 合并每组
#     for i in range(len(group_dict)):
#         for group_id, node_ids in group_dict[i].items():
#             merged_children = []
#             for nid in node_ids:
#                 # 如果节点不存在，跳过
#                 if nid not in nodes:
#                     continue
#                 merged_children.extend(nodes[nid].get('children', []))
#             # 去重
#             merged_children_dict = {}
#             for c in merged_children:
#                 merged_children_dict[c.get('name')] = c
#             merged_children = list(merged_children_dict.values())
#             # 新建合并节点
#             merged_node = {
#                 'name': f'group_{group_id}',
#                 'intro': f'合并节点 {group_id}',
#                 'children': merged_children,
#                 # 其它字段可自定义
#             }
#             nodes[f'group_{group_id}'] = merged_node

#             # 3. 父节点指向合并节点
#             for nid in node_ids:
#                 pid = parent_map.get(nid)
#                 if pid and pid in nodes:
#                     # 替换父节点的children
#                     new_children = []
#                     for c in nodes[pid].get('children', []):
#                         if c.get('name') == nid:
#                             new_children.append(merged_node)
#                         else:
#                             new_children.append(c)
#                     nodes[pid]['children'] = new_children
#                 # 删除原节点（如果存在）
#                 if nid in nodes:
#                     del nodes[nid]
#     return nodes

if __name__ == "__main__":
    queue_dir = r"queue"  # 假设queue目录和本脚本同级
    crash_dir = r"crashes"
    hang_dir = r"hangs"
    same_dir = r"same"
    same_dict = {}
    save_if_same(same_dict, same_dir, crash_dir)

    tree = build_tree(queue_dir, crash_dir, hang_dir)

    # with open(r"Q:\Aa-Capstone\NodeTree\public\merge.json", 'r') as f:
    #     group_dict = f.read()
    # group_dict = json.loads(group_dict)
    # tree = merge_nodes_by_group(tree, group_dict)
    
    # 1. 生成 links 列表
    tmp_dir = r"tmp"  # 修改为你的tmp目录实际路径
    crash_operator_dir = r"crash"
    hang_operator_dir = r"hang"
    links = []

    for fname in os.listdir(tmp_dir):
        fpath = os.path.join(tmp_dir, fname)
        if not os.path.isfile(fpath):
            continue
        # 解析文件名
        id_val, src_val = parse_filename(fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        # 只保留数字部分（和nodes处理方式一致）
        numbers1 = re.findall(r'\d+', id_val)
        if numbers1[0] == '000000':
            tid = '0'
        else:
            tid = re.search(r'([1-9]\d*)0*$', id_val)
            tid = tid.group(1) if tid else id_val

        numbers2 = re.findall(r'\d+', src_val)
        if numbers2[0] == '000000':
            sid = '0'
        else:
            sid = re.search(r'([1-9]\d*)0*$', src_val)
            sid = sid.group(1) if sid else src_val

        links.append({
            "source": sid,
            "target": tid,
            "content": content
        })
    
    n = 0
    for fname in os.listdir(crash_operator_dir):
        fpath = os.path.join(crash_operator_dir, fname)
        if not os.path.isfile(fpath):
            continue
        # 解析文件名
        src_val, _ = parse_filename(fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        # 只保留数字部分（和nodes处理方式一致）
        numbers2 = re.findall(r'\d+', src_val)
        if numbers2[0] == '000000':
            sid = '0'
        else:
            sid = re.search(r'([1-9]\d*)0*$', src_val)
            sid = sid.group(1) if sid else src_val

        links.append({
            "source": sid,
            "target": f"crash {n}",
            "content": content
        })
        n = n + 1
    
    n = 0
    for fname in os.listdir(hang_operator_dir):
        fpath = os.path.join(hang_operator_dir, fname)
        if not os.path.isfile(fpath):
            continue
        # 解析文件名
        _, src_val = parse_filename(fname)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        # 只保留数字部分（和nodes处理方式一致）
        numbers2 = re.findall(r'\d+', src_val)
        if numbers2[0] == '000000':
            sid = '0'
        else:
            sid = re.search(r'([1-9]\d*)0*$', src_val)
            sid = sid.group(1) if sid else src_val

        links.append({
            "source": sid,
            "target": f"hang {n}",
            "content": content
        })
        n = n + 1

    # 2. 导出时加上 links 字段
    with open(r"Nodetree\public\b.json", "w", encoding="utf-8") as f:
        json.dump({"nodes": list(tree.values()), "links": links}, f, ensure_ascii=False, indent=2)