const freeze = value => Object.freeze(value);

const ZERO_EFFECTS = freeze({
  cash: 0,
  attack: 0,
  defense: 0,
  cohesion: 0,
  community: 0,
  facility: 0,
  energy: 0,
  support: 0,
  shenInfluence: 0
});

function choice(id, label, detail, resultCopy, tag, effectPatch, relationships) {
  return freeze({
    id,
    label,
    detail,
    resultCopy,
    tag,
    effects: freeze({ ...ZERO_EFFECTS, ...effectPatch }),
    relationships: freeze({ ...relationships })
  });
}

function incident(id, title, speakerId, mapId, locationId, kicker, beats, choices) {
  return freeze({
    id,
    title,
    speakerId,
    mapId,
    locationId,
    kicker,
    beats: freeze(beats.map(beat => String(beat))),
    choices: freeze(choices)
  });
}

export const SEASON_EVENTS = freeze([
  incident('shared-pitch', '谁先用半块场地', 'xiaoman', 'training', 'training-sideline', '训练开始以前', [
    '社区青训的孩子已经换好鞋，一队也比计划早到了半小时。两边都在等中线空出来。',
    '小满没有问谁更重要。他问的是，这次谁来决定别人往后站。'
  ], [
    choice('share-half', '把半块场地画出来', '一队缩短对抗距离，孩子们保留约好的时段', '中线旁多画了一道白线。两边的球偶尔滚到一起，也有人主动把球传回去。', 'community', { cohesion: 2, community: 4 }, { xiaoman: 1, 'coach-guo': 0 }),
    choice('first-team-first', '先让一队完整训练', '比赛准备更充分，青训时段向后推迟', '一队完成了整场训练。孩子们在围网外等到天色变暗，小满替他们把器材收好。', 'attack', { attack: 4, community: -2 }, { 'coach-guo': 1, xiaoman: -1 }),
    choice('youth-leads', '让年轻人带第一组热身', '训练节奏慢一点，但年轻人不再只是旁观者', '小满第一次站在队伍前面点名。郭教练没有接过口令，只在最后补了一个动作。', 'youth', { defense: 1, cohesion: 3, community: 1 }, { xiaoman: 1, 'coach-guo': -1 })
  ]),
  incident('storm-drain', '暴雨后的排水口', 'lin-chuan', 'stadium', 'stadium-drain', '海水退下以后', [
    '昨晚的雨把海草和塑料瓶推到主看台下面，两个排水口已经不再往外流水。',
    '林川说周末仍能比赛，但只要再下一场雨，看台下面就会先积水。'
  ], [
    choice('hire-repair', '马上叫人来抢修', '花一笔现金，把排水和护栏一次处理完', '维修车在傍晚离开，排水口重新露出金属边。林川把验收照片贴进了办公室。', 'stands', { cash: -26, facility: 8 }, { 'lin-chuan': 1 }),
    choice('community-clean', '请社区一起清理', '少花钱，但要公开说明球场没有足够维护预算', '二十多人带着手套来到看台下。许姨煮了热水，账本上也多了一行真实缺口。', 'community', { cash: -8, community: 4, facility: 5 }, { 'aunt-xu': 1, 'lin-chuan': 0 }),
    choice('close-two-rows', '先封掉两排座位', '不花现金，观众空间和社区信任会受影响', '两条红绳封住了积水附近的座位。安全暂时保住了，入口却一直有人问为什么。', 'defense', { defense: 2, community: -2, facility: 1 }, { 'director-luo': 1, 'lin-chuan': -1 })
  ]),
  incident('sore-knee', '小满说膝盖有点疼', 'xiaoman', 'training', 'training-bench', '训练名单写好以后', [
    '小满把护膝往上拉了两次，才说昨天回家以后膝盖一直发热。',
    '他不想被自动划出名单，也不想等到真正受伤以后才有人相信。'
  ], [
    choice('full-rest', '这轮先完整休息', '保护身体，也明确告诉全队休息不是失去位置', '小满坐在边线记录整堂训练。第二天他走路不再躲着右腿，名单上的名字也没有被擦掉。', 'clinic', { cohesion: 2, energy: 10 }, { xiaoman: 1, 'coach-guo': 1 }),
    choice('let-him-decide', '把每天感觉交给他自己报', '保留参与感，训练内容随身体情况调整', '小满每天先说膝盖是什么感觉，再决定参加哪一组。他第一次不需要用逞强证明自己。', 'cohesion', { defense: 1, cohesion: 4 }, { xiaoman: 1, 'coach-guo': 0 }),
    choice('train-through', '按原计划继续训练', '获得直接的进攻准备，但伤病信任会下降', '小满完成了全部对抗，最后一个离开球场。没人再提他热得发红的膝盖。', 'attack', { attack: 5, energy: -8 }, { xiaoman: -1, 'coach-guo': -1 })
  ]),
  incident('broadcast-contract', '直播合同多了一行字', 'shen-qiao', 'stadium', 'stadium-office', '摄像机到场以前', [
    '沈峤带来的直播合同能立刻支付两周开支，最后一行却写着赞助方可以调整比赛日安排。',
    '罗馆长说这行字不是不能签，但必须有人承认它改变了谁的决定权。'
  ], [
    choice('sign-exclusive', '签下完整独家条件', '现金最多，赞助方对比赛日的影响也更大', '直播车准时进场，钱也准时到账。沈峤把新的通行证挂在胸前，没有再问办公室里的其他人。', 'attack', { cash: 58, community: -3, shenInfluence: 1 }, { 'shen-qiao': 1, 'director-luo': -1 }),
    choice('publish-terms', '公开条件后再签', '收入减少，但所有人都能看见交换了什么', '删改后的合同贴在入口，直播费少了一部分。沈峤签字时没有笑，却也没有收回设备。', 'community', { cash: 30, community: 2, support: 1 }, { 'shen-qiao': 1, 'director-luo': 1 }),
    choice('refuse-control', '拒绝比赛日干预权', '没有直播预付款，球队更相信决定仍在自己手里', '摄像机没有进场。林川把原来的比赛时间重新写回白板，沈峤带走了没有签名的合同。', 'cohesion', { cohesion: 3, support: 1, shenInfluence: -1 }, { 'shen-qiao': -1, 'lin-chuan': 1 })
  ]),
  incident('missing-wage', '工资袋少了一份', 'aunt-xu', 'training', 'training-shop', '小店关门以后', [
    '许姨清点工资袋时发现本周少了一份。不是算错，是现金真的只够发给其中几个人。',
    '林川说不能再让大家假装团结，然后各自猜谁会被排到最后。'
  ], [
    choice('pay-now', '先把工资补齐', '立刻花钱，让本周每个人都拿到相同承诺', '安若童从工程预算里补上缺口。工资袋一起发下去，下一项建设只能再等一轮。', 'cohesion', { cash: -36, cohesion: 4 }, { 'aunt-xu': 1, 'lin-chuan': 1 }),
    choice('open-ledger', '把缺口和账本一起公开', '先付一部分，并让所有人知道剩余日期', '每个工资袋里都有一张相同的欠款日期。数字不好看，但没有人需要猜自己是不是被单独放弃。', 'market', { cash: -16, community: 2, support: 1 }, { 'aunt-xu': 1, 'director-luo': 1 }),
    choice('protect-build', '先保住已经开工的工程', '球场状态提高，球队内部会记住这次顺序', '材料车照常进场，工资袋却少了一只。林川没有当场争吵，只把训练提前结束。', 'stands', { cohesion: -3, facility: 4 }, { 'aunt-xu': -1, 'lin-chuan': -1 })
  ]),
  incident('early-supporters', '客队球迷提前到了', 'director-luo', 'stadium', 'guest-gate', '开门时间以前', [
    '客队球迷提前两小时到了入口。原本给社区摊位的通道，现在同时要放下检票桌和临时隔离栏。',
    '罗馆长说不能把任何一群人当成麻烦本身，入口怎么安排才是球场的责任。'
  ], [
    choice('shared-welcome', '一起打开社区入口', '安排志愿者接待，保留摊位和共同通道', '主客队球迷在同一排摊位前排队。有人唱错了队歌，也有人把多余的雨衣递给对面。', 'community', { community: 5, facility: -1 }, { 'director-luo': 1, 'aunt-xu': 1 }),
    choice('separate-route', '搭一条临时分流通道', '花钱换取更清楚的安全边界', '隔离栏从入口一直铺到客队看台。通道不热闹，但每个人都知道自己该往哪里走。', 'defense', { cash: -20, defense: 2, facility: 3 }, { 'director-luo': 1, 'lin-chuan': 0 }),
    choice('close-market', '暂停集市保证备战', '球队少受干扰，摊主和社区承担损失', '入口只留下检票和安保。球队热身很安静，许姨把没有卖出的食物一箱箱搬回小店。', 'attack', { attack: 3, community: -4 }, { 'lin-chuan': 1, 'aunt-xu': -1 })
  ]),
  incident('elite-inspection', '精英评审没有提前通知', 'director-luo', 'stadium', 'stadium-office', '收官轮当天', [
    '精英邀请赛评审在上午直接到了球场。他们想看设施、账本，也想知道谁能代表这里回答。',
    '六个人都在办公室外，没有人愿意再被临时安排成一个好看的背景。'
  ], [
    choice('show-results', '先带他们看球队准备', '用训练和比赛结果证明海风队够得上更强对手', '郭教练带评审走完整条训练路线，每个队员都说清楚自己负责的部分。', 'coach', { attack: 2, defense: 2 }, { 'coach-guo': 1, 'lin-chuan': 1 }),
    choice('open-every-book', '先把全部账本摊开', '公开收入、欠款和每项工程由谁维护', '办公室的桌子铺满收据和会议记录。数字并不漂亮，但每一笔都能找到负责的人。', 'cohesion', { community: 1, support: 2 }, { 'director-luo': 1, 'shen-qiao': -1 }),
    choice('see-community-first', '先请他们看社区时段', '让评审先理解球场为什么必须留下', '评审坐在边线等孩子们踢完最后一局。许姨递去热水，小满负责把球一个个收回来。', 'community', { cash: -10, community: 5, cohesion: 1 }, { 'aunt-xu': 1, xiaoman: 1 })
  ]),
  incident('market-cleanup', '集市收摊以后没人走', 'aunt-xu', 'training', 'training-shop', '比赛散场以后', [
    '海风集市赚到了钱，摊位后的纸箱、油渍和一次性杯子也留了下来。',
    '许姨没有说谁该负责。她只是把最后一卷垃圾袋放在柜台上。'
  ], [
    choice('team-cleans', '球队一起留下来收拾', '牺牲恢复时间，让球员看见经营不是场外的事', '球队分成三组收完最后一排纸杯。林川关灯时，许姨已经把第二天的水烧上。', 'cohesion', { cohesion: 3, facility: 2, energy: -5 }, { 'aunt-xu': 1, 'lin-chuan': 1 }),
    choice('hire-cleaners', '从收入里请清洁人员', '花钱保住恢复时间，也让工作得到明确报酬', '清洁人员拿着写清金额的单据进场。第二天早晨，集市区没有一袋垃圾留在风里。', 'market', { cash: -22, facility: 6 }, { 'aunt-xu': 1 }),
    choice('leave-for-morning', '明早训练前再处理', '今晚不花钱，场地和小店关系会受损', '海风把几个纸杯吹进围网。第二天球队提前到场，却先花了半堂训练捡垃圾。', 'attack', { attack: 2, facility: -3 }, { 'aunt-xu': -1, 'coach-guo': 0 })
  ]),
  incident('captain-vote', '队长该不该有一票', 'lin-chuan', 'stadium', 'stadium-office', '名单公布以前', [
    '下一轮首发名单出现了分歧。郭教练认为最后决定必须统一，林川说更衣室不能只在决定以后被通知。',
    '争论的不是某个名字，而是谁能参与决定一支表面团结的球队。'
  ], [
    choice('captain-final', '让队长保留一票', '队长承担更大责任，教练的最终权力变小', '林川写下自己的一票和理由。名单仍由郭教练公布，但不再只有一个人的笔迹。', 'defense', { defense: 3, cohesion: 1 }, { 'lin-chuan': 1, 'coach-guo': -1 }),
    choice('five-party-talk', '把分歧带到五方会议', '花时间讨论，让程序和更衣室都留下记录', '五把椅子又搬回办公室。讨论很慢，最后每个人都知道哪一条意见没有被采用。', 'cohesion', { cohesion: 4, support: 1, energy: -4 }, { 'lin-chuan': 1, 'director-luo': 1 }),
    choice('manager-signs', '由安若童最后签名单', '责任集中，训练执行会更直接', '安若童在名单下签了自己的名字。训练很快开始，林川把没说完的话留在白板背面。', 'attack', { attack: 3, support: -1 }, { 'lin-chuan': -1, 'director-luo': -1 })
  ])
]);

export function getSeasonEvent(roundIndex, seasonNumber = 1) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex > 6) throw new TypeError('Unknown season event round');
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) throw new TypeError('Invalid season number');
  const offset = (seasonNumber - 1) * 3;
  return SEASON_EVENTS[(roundIndex + offset) % SEASON_EVENTS.length];
}

export function getSeasonEventChoice(eventId, choiceId) {
  const event = SEASON_EVENTS.find(item => item.id === eventId);
  if (!event) throw new TypeError('Unknown season event');
  const selected = event.choices.find(item => item.id === choiceId);
  if (!selected) throw new TypeError('Unknown season event choice');
  return selected;
}
