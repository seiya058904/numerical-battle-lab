# Combat Plugin API v1

目标：只有当出现“全新的规则原语”时才写插件；新增普通角色、卡、技能、状态只应组合已有参数与组件。

## Manifest

```js
NCB.registerCombatPlugin({
  id: 'example-pack',
  version: '1.0.0',
  apiVersion: 1,

  parameters: [
    {
      id: 'MORALE',
      name: '士气',
      category: '插件',
      kind: 'number',
      unit: 'point',
      defaultValue: 0,
      range: '0–100',
      human: '影响士气相关公式。',
      ai: 'numeric resource exposed to formula scope',
      effect: '越高时可提高士气系技能。'
    }
  ],

  conditions: {
    moraleAbove: {
      name: '士气阈值',
      human: '当士气高于阈值时成立。',
      ai: 'resource threshold predicate',
      test: (condition, ctx) =>
        ctx.battle.getResource(ctx.source, 'MORALE') >= condition.value
    }
  },

  targets: {
    lowestEnemy: {
      name: '最低生命敌人',
      human: '选择生命最低的敌人。',
      ai: 'lowest hp legal enemy',
      select: ({battle, actor}) =>
        battle.getLiving(battle.enemyTeam(actor.teamId))
          .sort((a,b) => a.hp - b.hp)
          .slice(0, 1)
    }
  },

  effects: {
    gainMorale: {
      name: '获得士气',
      human: '增加任意实体的 MORALE。',
      ai: 'resource gain primitive',
      resolve: ({engine, target, effect}) =>
        engine.changeResource(target, 'MORALE', effect.amount)
    }
  },

  events: {
    ModifyMoraleGain: {
      name: '士气获取修正',
      human: '允许状态修改士气获取量。',
      ai: 'relay modifier event'
    }
  },

  damageTypes: {
    psychic: { name: '精神', defenseStat: 'RES' }
  }
});
```

## 插件边界

插件可以增加：

- Parameter：新的可调数值语义。
- Condition：新的合法性/分支条件。
- Target：新的目标选择规则。
- Effect：新的原子效果。
- Event：新的 relay modifier 插入点。
- Damage Type：新的伤害类型与防御轴。

插件不应该：

- 判断具体角色 ID。
- 判断具体技能 ID。
- 在 UI 中维护另一套战斗规则。
- 绕过 canonical RNG。
- 直接修改 replay 不可序列化的隐藏状态。

## 内容层应该长什么样

普通技能只写数据：

```js
{
  id: 'example-skill',
  target: 'enemy',
  costs: [{resource:'ENERGY', amount:2}],
  cooldown: 2,
  priority: 0,
  accuracy: 0.95,
  requirements: {type:'resourceAtLeast', resource:'MORALE', value:3},
  effects: [
    {type:'damage', damageType:'psychic', formula:'ATK * 1.15 + MORALE * 6'},
    {type:'status', status:'marked', chance:0.4, duration:2, condition:{type:'lastHit'}}
  ]
}
```

这类内容不需要修改 `BattleEngine`。
