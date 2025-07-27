import subprocess
import os
import re

def parse_filename(filename):
    """
    解析文件名，返回id和src
    文件名格式: id 000001,src 000000,time 34,execs 318,op inf,pos 0,+cov
    """
    m = re.match(r'^(.*?)time', filename)
    try:
        arr = m.group(1).split(',')
    except:
        return None, None
    
    return arr[2], None

# 设置你的路径
target_dir = "output/default/crashes"
xml_fuzz = "./xml_fuzz"
output_file = "same"

for crash_fname in os.listdir(target_dir):
    if crash_fname == "README.txt":
        continue
    fpath = os.path.join(target_dir, crash_fname)

    # 构造命令
    cmd = [xml_fuzz, fpath]

    # 执行命令
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10  # 防止卡死
    )

    # 输出捕获的信息
    # print("STDOUT:", result.stdout.decode())
    # print("STDERR:", result.stderr.decode())

    crash_val, _ = parse_filename(crash_fname)

    numbers3 = re.findall(r'\d+', crash_val)
    if numbers3[0] == '000000':
        crash_fsrc = '0'
    else:
        crash_fsrc = re.search(r'([1-9]\d*)0*$', crash_val)
        crash_fsrc = crash_fsrc.group(1) if crash_fsrc else crash_val

    f = open(output_file + "/" + crash_fname, "a+")
    f.write(result.stderr.decode())
    f.close()