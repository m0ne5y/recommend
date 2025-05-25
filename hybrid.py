import pandas as pd
import numpy as np
from surprise import Dataset, Reader, KNNBasic
import paddle
import paddle.nn as nn
from paddle.io import DataLoader, Dataset as PaddleDataset

# 1. 读取用户-游戏行为数据
behavior_df = pd.read_csv("simulated_user_game_behavior.csv", dtype={'GameID':str})
# 可选：限制用户/游戏数量便于调试
# behavior_df = behavior_df[behavior_df['UserID'].isin([f"user_{i}" for i in range(100)])]

# 2. 协同过滤召回阶段
# 构造兴趣分：评分优先，无评分则用点击次数（+购买权重）
def interest_score(row):
    score = row['Rating'] if row['Rating'] > 0 else 2 + np.log1p(row['ClickCount'])
    if row['Buy'] > 0:
        score += 2
    return score
behavior_df['Interest'] = behavior_df.apply(interest_score, axis=1)
cf_ratings = behavior_df[['UserID', 'GameID', 'Interest']].copy()
cf_ratings.columns = ['UserID', 'GameID', 'Rating']

reader = Reader(rating_scale=(1, 10))
cf_data = Dataset.load_from_df(cf_ratings, reader)
trainset = cf_data.build_full_trainset()
cf_algo = KNNBasic(sim_options={'name': 'cosine', 'user_based': True})
cf_algo.fit(trainset)

def recall_candidates(cf_algo, behavior_df, user_id, top_n=20):
    all_games = behavior_df['GameID'].unique()
    rated_games = behavior_df[behavior_df['UserID'] == user_id]['GameID'].values
    unrated_games = [g for g in all_games if g not in rated_games]
    preds = [cf_algo.predict(user_id, g) for g in unrated_games]
    top_preds = sorted(preds, key=lambda x: x.est, reverse=True)[:top_n]
    return [pred.iid for pred in top_preds]

# 3. FLEN排序模型
user_encoder = {u: i for i, u in enumerate(behavior_df['UserID'].unique())}
game_encoder = {g: i for i, g in enumerate(behavior_df['GameID'].unique())}
behavior_df['user_idx'] = behavior_df['UserID'].map(user_encoder)
behavior_df['game_idx'] = behavior_df['GameID'].map(game_encoder)

class FLENDataset(PaddleDataset):
    def __init__(self, data):
        self.u = data['user_idx'].values
        self.g = data['game_idx'].values
        self.click = data['ClickCount'].values.astype('float32')
        self.rating = data['Rating'].values.astype('float32')
        self.buy = data['Buy'].values.astype('float32')
        # 标签定义：高评分或已购买为兴趣1，否则0
        self.label = ((data['Rating']>=4)|(data['Buy']==1)).astype('int64')
    def __len__(self):
        return len(self.u)
    def __getitem__(self, idx):
        return (
            paddle.to_tensor(self.u[idx]),
            paddle.to_tensor(self.g[idx]),
            paddle.to_tensor([self.click[idx], self.rating[idx], self.buy[idx]]),
            paddle.to_tensor(self.label[idx])
        )

class FLEN(nn.Layer):
    def __init__(self, n_users, n_games, emb_dim=16):
        super().__init__()
        self.u_emb = nn.Embedding(n_users, emb_dim)
        self.g_emb = nn.Embedding(n_games, emb_dim)
        self.fc1 = nn.Linear(emb_dim*2+3, 32)
        self.fc2 = nn.Linear(32, 16)
        self.fc3 = nn.Linear(16, 2)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
    def forward(self, u, g, feats):
        ue = self.u_emb(u)
        ge = self.g_emb(g)
        x = paddle.concat([ue, ge, feats], axis=1)
        x = self.dropout(self.relu(self.fc1(x)))
        x = self.dropout(self.relu(self.fc2(x)))
        x = self.fc3(x)
        return x

# 训练FLEN
dataset = FLENDataset(behavior_df)
loader = DataLoader(dataset, batch_size=128, shuffle=True)
flen_model = FLEN(len(user_encoder), len(game_encoder))
opt = paddle.optimizer.AdamW(parameters=flen_model.parameters(), learning_rate=0.005)
loss_fn = nn.CrossEntropyLoss()
for epoch in range(5):
    flen_model.train()
    for u, g, feats, label in loader:
        logits = flen_model(u, g, feats)
        loss = loss_fn(logits, label)
        loss.backward()
        opt.step()
        opt.clear_grad()
    print(f"FLEN Epoch {epoch+1} done")

# 4. 混合推荐主流程
def hybrid_recommend(user_id, cf_algo, flen_model, user_encoder, game_encoder, behavior_df, topk=5):
    candidates = recall_candidates(cf_algo, behavior_df, user_id, top_n=30)
    uidx = user_encoder[user_id]
    gids = [game_encoder[g] for g in candidates]
    feats = []
    for g in candidates:
        row = behavior_df[(behavior_df['UserID']==user_id)&(behavior_df['GameID']==g)]
        if not row.empty:
            feats.append([row['ClickCount'].values[0], row['Rating'].values[0], row['Buy'].values[0]])
        else:
            # 未交互游戏用0填补
            feats.append([0,0,0])
    flen_model.eval()
    with paddle.no_grad():
        u_tensor = paddle.to_tensor([uidx]*len(gids))
        g_tensor = paddle.to_tensor(gids)
        feat_tensor = paddle.to_tensor(np.array(feats).astype('float32'))
        logits = flen_model(u_tensor, g_tensor, feat_tensor)
        probs = nn.functional.softmax(logits, axis=1)[:, 1].numpy()
    sorted_games = [g for _, g in sorted(zip(probs, candidates), reverse=True)][:topk]
    return sorted_games

# 示例：为user_0推荐
test_user = "user_0"
recs = hybrid_recommend(test_user, cf_algo, flen_model, user_encoder, game_encoder, behavior_df)
print(f"为{test_user}推荐Top游戏（GameID）：", recs)