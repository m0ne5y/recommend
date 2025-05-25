import sqlite3
import os

# 数据库路径（直接用绝对路径，别用os.path.join）
DATABASE = r'D:\pythonProject4\database\recommendation_system.db'

# 确保 database 文件夹存在
os.makedirs(os.path.dirname(DATABASE), exist_ok=True)

# 创建数据库连接
conn = sqlite3.connect(DATABASE)
cursor = conn.cursor()

# 创建 games 表
cursor.execute('''
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    primary_genre TEXT,
    rating REAL,
    description TEXT,
    icon_url TEXT,
    price REAL,
    release_date TEXT
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS user_behavior (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    rating REAL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (game_id) REFERENCES games (id)
)
''')

conn.commit()
conn.close()
print("数据库初始化完成！")