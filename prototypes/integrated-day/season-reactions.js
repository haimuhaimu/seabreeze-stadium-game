const freeze = value => Object.freeze(value);

function reactionChoice(reactions) {
  return freeze({ ...reactions });
}

function reactionEvent(choices) {
  return freeze(Object.fromEntries(Object.entries(choices).map(([choiceId, reactions]) => [
    choiceId,
    reactionChoice(reactions)
  ])));
}

export const SEASON_EVENT_REACTIONS = freeze({
  'shared-pitch': reactionEvent({
    'share-half': {
      xiaoman: '孩子们问下周还能不能用那道白线。我告诉他们，约好的时段不会只算一次。',
      'coach-guo': '半场训练比我想的更挤，但队员开始抬头看人。那道白线没有毁掉备战。'
    },
    'first-team-first': {
      'coach-guo': '完整训练确实让路线顺了，可我看见孩子一直在围网外等。这个次序不能假装没有代价。',
      xiaoman: '我替孩子们收完器材。他们没有闹，只问下次是不是还会被排到最后。'
    },
    'youth-leads': {
      xiaoman: '第一次点名时我差点忘了口令。后来大家真的照我说的跑了，不是哄我玩。',
      'coach-guo': '我把口令交出去，不等于不负责。下次年轻人带队，也得把为什么说清楚。'
    }
  }),
  'storm-drain': reactionEvent({
    'hire-repair': {
      'lin-chuan': '验收照片和发票都贴好了。钱花得快，但下场雨来时不用再赌看台会不会积水。',
      'director-luo': '抢修不是把钱交出去就结束。林川留下了验收记录，这笔支出才算有人负责。'
    },
    'community-clean': {
      'aunt-xu': '来帮忙的人把热水喝完才走。他们看见了缺口，也没有因为账不好看就转身。',
      'lin-chuan': '排水口通了，维护预算不够的事也传开了。以后再说缺钱，大家知道不是借口。'
    },
    'close-two-rows': {
      'director-luo': '封两排是合规的临时决定，但红绳不能永远代替维修计划。下轮要给出日期。',
      'lin-chuan': '安全暂时保住了。入口每解释一次为什么封座，我就更清楚这不是免费办法。'
    }
  }),
  'sore-knee': reactionEvent({
    'full-rest': {
      xiaoman: '名单上的名字没有被擦掉，我才真的敢坐下来休息。以前休息总像是在主动退出。',
      'coach-guo': '他没上对抗，反而把训练记录得很完整。保护一个位置，有时不是把人推上场。'
    },
    'let-him-decide': {
      xiaoman: '每天先说膝盖是什么感觉，比装作没事难多了。至少现在报告疼痛不会直接失去位置。',
      'coach-guo': '我开始先问他今天能做什么，再写训练量。教练的判断也可以从听见本人开始。'
    },
    'train-through': {
      xiaoman: '我把整堂训练跑完了，膝盖也确实更热。别只记住我没有中途停下。',
      'coach-guo': '进攻路线练出来了，可我不该把能坚持当成没有受伤。下次我会先看他的走路姿势。'
    }
  }),
  'broadcast-contract': reactionEvent({
    'sign-exclusive': {
      'shen-qiao': '直播款已经到账，设备也归我调度。你们要成绩，我给了最直接的条件。',
      'director-luo': '新通行证已经能打开比赛日办公室。那行合同不是小字，它真的改变了谁可以进门。'
    },
    'publish-terms': {
      'shen-qiao': '公开以后少了一部分钱，也多了很多人盯着条款。我会按这份删改后的合同办。',
      'director-luo': '入口那份合同有人停下来读。交换了什么被看见，签字才不只是几个人的秘密。'
    },
    'refuse-control': {
      'shen-qiao': '你们拒绝了我的比赛日安排权，也拒绝了一笔真金白银。下一次缺口来时别装作没选过。',
      'lin-chuan': '原来的开赛时间写回白板以后，更衣室里没人欢呼，但大家知道时间还由这里决定。'
    }
  }),
  'missing-wage': reactionEvent({
    'pay-now': {
      'aunt-xu': '工资袋一起发下去了，没有人需要看别人拿到没有。工程晚一轮，这笔账也会写着。',
      'lin-chuan': '队里知道钱是从建设预算挪来的。我们会记住工资补齐了，也会记住看台为什么还没动工。'
    },
    'open-ledger': {
      'aunt-xu': '每个人拿到的是同一张欠款日期。钱还没全到，但至少没人怀疑自己被单独排在最后。',
      'director-luo': '公开账本不是把困难推给大家。日期和负责人都写清楚，公开才算一种承诺。'
    },
    'protect-build': {
      'aunt-xu': '材料车进场时，柜台下面还少一个工资袋。我不会替这项工程说它没有让谁等待。',
      'lin-chuan': '训练提前结束不是闹脾气。你选择先保工程，我们也有资格让场上的代价被看见。'
    }
  }),
  'early-supporters': reactionEvent({
    'shared-welcome': {
      'director-luo': '同一个入口没有出事，是因为志愿者提前说清了路线。开放不等于把安全交给运气。',
      'aunt-xu': '主客队球迷在同一排摊位买水。有人唱错队歌，倒没人因此少喝一杯热茶。'
    },
    'separate-route': {
      'director-luo': '临时通道把边界说清楚了，花掉的钱也有记录。安全安排不必先把客队当成敌人。',
      'lin-chuan': '隔离栏不热闹，但队员进场时不用和人群挤在一起。这笔钱买到的是确定。'
    },
    'close-market': {
      'aunt-xu': '没卖出的食物都搬回来了。球队热身很安静，可摊主承担的损失不能在比分里消失。',
      'lin-chuan': '备战确实少了干扰。如果以后每次重要比赛都先关集市，那就要承认我们选择了什么球场。'
    }
  }),
  'elite-inspection': reactionEvent({
    'show-results': {
      'coach-guo': '评审走完了整条训练路线。队员能说清自己的职责，比我一个人替全队回答更有用。',
      'lin-chuan': '每个人都开口以后，成绩不再只是教练和经理的证词。我们自己也能说明准备从哪里来。'
    },
    'open-every-book': {
      'director-luo': '收据、欠款和维护人都摊在桌上。数字不漂亮，却没有一项工程找不到负责的人。',
      'shen-qiao': '你把所有账本都给评审看了，包括和我的合同。透明会赢得信任，也会失去谈判空间。'
    },
    'see-community-first': {
      'aunt-xu': '评审坐在边线等孩子踢完，没有催他们让场。那杯热水比准备好的介绍词管用。',
      xiaoman: '我把最后一个球收回来时，评审还在看。社区时段第一次不是比赛前用来装点的背景。'
    }
  }),
  'market-cleanup': reactionEvent({
    'team-cleans': {
      'aunt-xu': '队员留下来捡完最后一排纸杯。以后再说小店是场外的事，他们自己会记得今晚。',
      'lin-chuan': '关灯前大家都很累，但没人把垃圾留给明早第一个到的人。这个分工可以写进下一场。'
    },
    'hire-cleaners': {
      'aunt-xu': '清洁人员拿着写清金额的单据来，不是来替大家免费收尾。有人劳动，就该有人付钱。',
      'director-luo': '清洁合同和比赛收入放在同一页，维护成本终于不是账本最后才想起来的一行。'
    },
    'leave-for-morning': {
      'aunt-xu': '海风把纸杯吹进围网时，我就知道明早谁会先弯腰。省下的钱没有让工作消失。',
      'coach-guo': '半堂训练用来捡垃圾，进攻准备还是被耽误了。推到明天不等于没有代价。'
    }
  }),
  'captain-vote': reactionEvent({
    'captain-final': {
      'lin-chuan': '我写下那一票以后，也要为理由负责。参与决定不是把输球责任推给教练。',
      'coach-guo': '名单上多了一种笔迹，我仍然负责公布。权力少一点，不代表责任就能少一点。'
    },
    'five-party-talk': {
      'lin-chuan': '讨论很慢，但没被采用的意见也留下了。我不需要靠猜测判断更衣室有没有被听见。',
      'director-luo': '五把椅子重新搬回来不是演程序。每条意见由谁提出、为什么没采用，都已经记下。'
    },
    'manager-signs': {
      'lin-chuan': '你签完名单，训练很快开始了。我把没说完的话写在白板背面，它不会因为效率消失。',
      'director-luo': '最后签名集中在安若童名下。以后名单带来什么结果，也会清楚地回到这个签字。'
    }
  })
});

function getReactionChoice(eventId, choiceId) {
  const event = SEASON_EVENT_REACTIONS[eventId];
  if (!event) throw new TypeError('Unknown season reaction event');
  const choice = event[choiceId];
  if (!choice) throw new TypeError('Unknown season reaction choice');
  return choice;
}

export function getSeasonEventReactionNpcIds(eventId, choiceId) {
  return Object.keys(getReactionChoice(eventId, choiceId));
}

export function getSeasonEventReaction(eventId, choiceId, npcId) {
  const copy = getReactionChoice(eventId, choiceId)[npcId];
  if (!copy) throw new TypeError('Unknown season reaction NPC');
  return copy;
}

