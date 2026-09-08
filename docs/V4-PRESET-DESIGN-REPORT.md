# V4 Preset Design Report — v1.3.1 curation pass

> Reviewed **60/60** · Adjusted **28** · Unchanged **32** · Replaced **0** · Total schema adjustments **83**.
> curationVersion **2**：从「随机精选样本」升级为「逐张设计的正式角色」。全部改动仅通过统一 Card Schema（stats / action 参数 / status / trigger / time vars / resist / affinity），无任何卡牌专属引擎代码。

## 调整统计

| 调整数 | 卡数 |
|---|---:|
| 0 | 32 |
| 1 | 3 |
| 2 | 7 |
| 3 | 7 |
| 4 | 10 |
| 5 | 1 |

## 调整最大的卡（Top 10 by adjustment count）

| 名称 | 稀有度 | Lv | BP | 调整数 | 主要调整 |
|---|---|---:|---:|---:|---|
| 渊影 | SS | 46 | 2623 | 5 | FATIGUE_RATE / FATIGUE_START / FATIGUE_CAP / 蚀爆.damage.coef |
| 苔痕 | C | 34 | 139 | 4 | FATIGUE_RATE / FATIGUE_START / FATIGUE_CAP / ENDURANCE |
| 影足 | B | 55 | 1055 | 4 | FATIGUE_RATE / FATIGUE_START / ENDURANCE / RAMP_CAP |
| 赤隼 | A | 14 | 277 | 4 | FATIGUE_START / FATIGUE_RATE / FATIGUE_CAP / 蚀爆.unconditional(1 dead-gate removed) |
| 夜枭 | A | 56 | 1528 | 4 | FATIGUE_START / FATIGUE_RATE / FATIGUE_CAP / 蚀爆.damage.coef |
| 孤峰 | A | 94 | 1006 | 4 | 突袭.unconditional(1 dead-gate removed) / FATIGUE_START / FATIGUE_RATE / FATIGUE_CAP |
| 苍翼 | S | 15 | 480 | 4 | 血性猛击.damage.coef / 血性猛击.damage.coef / ENDURANCE / FATIGUE_CAP |
| 暗星 | S | 95 | 3048 | 4 | 蚀爆.unconditional(1 dead-gate removed) / FATIGUE_RATE / ENDURANCE / 蚀爆.damage.coef |
| 棱镜 | SS | 66 | 5274 | 4 | 蚀爆.unconditional(1 dead-gate removed) / FATIGUE_RATE / FATIGUE_START / FATIGUE_CAP |
| 深渊 | XS | 39 | 2813 | 4 | ENDURANCE / FATIGUE_RATE / FATIGUE_START / 血性猛击.priority |

## 每张卡设计记录

| 名称 | 稀有度 | Lv | BP | 特点 | 时间 | 调整 | 设计说明 |
|---|---|---:|---:|---|---:|---|---|
| 砂砾 | C | 12 | 227 | 稳定 / 长线型 / DoT / 状态压制 | mixed | 3 | 低稀有度状态型长线样本：坚守+破咒叠盾减伤撑到后期成长，蚀爆耗蚀层爆发。压速局：为成长峰值（约第40回合）后接轻度疲劳，让对称长局能收束而不是无限平局。 |
| 苔痕 | C | 34 | 139 | 高波动 / 易疲劳 / 低爆发 / 穿透 | fatigue | 4 | 高波动低爆发纯防守/损耗卡：EVA姿态减伤拖时间，承诺的“长期损耗”此前从未开启（FATIGUE=0+ENDURANCE 98近似无敌，镜像83回合0伤害）。真正点亮损耗收尾，让磨损局有限回合内必然分胜负。 |
| 灰雀 | C | 54 | 608 | 稳定 / 后期成长 / 穿透 / DoT | ramp | 0 | 灰雀：展示延后成长与低波动。行动组合：战意、蚀爆、净化、号令；机制：toggleStatus / status / consumeStatus / damage / repeat / conditional / cleanse / gain / emitEvent。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 雾芽 | C | 74 | 599 | 稳定 / 易疲劳 / 高速 / 穿透 | fatigue | 0 | 雾芽：展示逐步疲劳与低波动。行动组合：回转、血性猛击、坚守、净化；机制：cooldownReduce / status / repeat / selfDamagePct / damage / shield / conditional / cleanse / gain。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 岩屑 | C | 92 | 2634 | 稳定 / 高爆发 / DoT / 穿透 | stable | 0 | 岩屑：展示稳定时间曲线与低波动。行动组合：蚀爆、战意、破咒、血性猛击；机制：repeat / status / consumeStatus / damage / toggleStatus / shield / dispel / gain / selfDamagePct。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 岩牙 | C_PLUS | 23 | 395 | 稳定 / DoT / 高速 / 高暴击 | stable | 0 | 岩牙：展示稳定时间曲线与低波动。行动组合：蚀爆、净化、复苏、破咒；机制：status / consumeStatus / damage / conditional / cleanse / gain / heal / dispel / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 铁爪 | C_PLUS | 43 | 495 | 高波动 / DoT / 吸血 / 高速 | stable | 0 | 铁爪：展示稳定时间曲线与高波动。行动组合：号令、蓄能、蚀爆、护符；机制：conditional / emitEvent / gain / repeat / resource / status / consumeStatus / damage / ward。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 霜芽 | C_PLUS | 63 | 1037 | 稳定 / 长线型 / 护盾型 / 高耐久 | mixed | 2 | 后期成长护盾型卡：第7回合起ATK 161→214第40回合触顶，但唯一终结蚀爆被AI零使用，镜像72回合0伤害平局。为成长高峰加真实疲劳，让护盾僵持有尽头。 |
| 钝角 | C_PLUS | 83 | 1696 | 稳定 / 易疲劳 / DoT / 穿透 | fatigue | 0 | 钝角：展示逐步疲劳与低波动。行动组合：战意、蚀爆、转化、复苏；机制：repeat / toggleStatus / gain / status / consumeStatus / damage / convertResource / heal / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 石甲 | C_PLUS | 100 | 2170 | 长线型 / 易疲劳 / 高耐久 / DoT | mixed | 0 | 石甲：展示先成长后疲劳与中波动。行动组合：血性猛击、蚀爆、复苏、战意；机制：repeat / conditional / selfDamagePct / damage / gain / status / consumeStatus / heal / shield / toggleStatus。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 风隼 | B | 13 | 560 | 稳定 / DoT / 穿透 / 吸血 | stable | 0 | 风隼：展示稳定时间曲线与低波动。行动组合：战意、转化、蚀爆、突袭；机制：toggleStatus / convertResource / status / consumeStatus / damage / shield / repeat / conditional / gain。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 银鳍 | B | 35 | 647 | 高波动 / DoT / 高速 / 状态引爆 | stable | 0 | 银鳍：展示稳定时间曲线与高波动。行动组合：蓄能、血性猛击、蚀爆、坚守、号令、蓄能；机制：conditional / resource / gain / repeat / selfDamagePct / damage / status / consumeStatus / shield / emitEvent。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 影足 | B | 55 | 1055 | 稳定 / 长线型 / DoT / 高耐久 | mixed | 4 | 宣称“后期成长”的高耐久重坦，实为0伤害纯肉盾（镜像87回合、面板62-87回合互磨盾）。RAMP_START顶格使成长假化。引入真实疲劳磨损 + 后期成长放大，把无限气泡改造成有推进的后期对局。 |
| 棘皮 | B | 75 | 740 | 易疲劳 / 高耐久 / 高回复 / 低伤控制 | fatigue | 0 | 棘皮：展示逐步疲劳与中波动。行动组合：血性猛击、破咒、护符、复苏；机制：conditional / selfDamagePct / damage / gain / dispel / status / ward / heal。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 烬羽 | B | 93 | 1925 | 稳定 / 高爆发 / DoT / 护盾型 | stable | 0 | 烬羽：展示稳定时间曲线与低波动。行动组合：蚀爆、回转、侵蚀、血性猛击；机制：status / consumeStatus / damage / shield / cooldownReduce / gain / selfDamagePct。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 雷纹 | B_PLUS | 24 | 391 | 稳定 / DoT / 护盾型 / 穿透 | stable | 0 | 雷纹：展示稳定时间曲线与低波动。行动组合：复苏、护符、侵蚀、破咒、蚀爆、号令；机制：conditional / heal / status / gain / repeat / ward / dispel / shield / consumeStatus / damage / emitEvent。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 暮潮 | B_PLUS | 44 | 814 | 高波动 / 易疲劳 / 高耐久 / 穿透 | fatigue | 3 | 易疲劳高耐久穿透卡，镜像69回合0伤害平局。FATIGUE_RATE过高把ATK 13回合内压到42.4平台，FATIGUE_CAP 0.53锁死爆发/DoT。放缓衰减、抬高峰值，并提升蚀爆（0.72系数过低）让DoT后期能终结。 |
| 星隙 | B_PLUS | 64 | 347 | 后期成长 / 高耐久 / 吸血 / 低伤控制 | ramp | 2 | 后期成长高耐久吸血低伤控制，镜像53回合0伤害。RAMP只把ATK 28→35、上限1.25，成长不足。强化ramp斜率与峰值让后期能击穿耐久。 |
| 玄岩 | B_PLUS | 84 | 2868 | 稳定 / 易疲劳 / 高爆发 / DoT | fatigue | 0 | 玄岩：展示逐步疲劳与低波动。行动组合：蚀爆、护符、血性猛击、战意；机制：status / consumeStatus / damage / shield / conditional / ward / gain / repeat / selfDamagePct / toggleStatus。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 羽冠 | B_PLUS | 100 | 719 | 高波动 / 长线型 / 高耐久 / 穿透 | mixed | 2 | 高耐久长线治愈位，镜像55回合 heal 2214>damage 1931 纯互磨。下调0.24大额治疗并加深后期疲劳，让战斗在成长/疲劳下真正分出胜负。 |
| 赤隼 | A | 14 | 277 | 稳定 / 易疲劳 / DoT / 高耐久 | fatigue | 4 | 纯防御坦克（HP222/DEF87），零疲劳零成长，镜像72回合0伤害、面板54-62回合0-24伤害。保留“稳定”身份，仅在60+回合僵持局施加后期疲劳时钟；同时解除蚀爆的hpPctBelow死门控（墙壁互磨时双方永不跌破50%，蚀爆永不触发），让它拥有真实伤害出口。 |
| 苍岩 | A | 36 | 785 | 高波动 / 易疲劳 / 穿透 / 高速 | fatigue | 3 | 高爆发穿透吸血打手，但过度自续航（回血+护盾+减伤），镜像62回合0伤害、SS面板56回合4伤害。保留前40+回合高速爆发窗口，仅在50+回合僵持施加后期疲劳。 |
| 夜枭 | A | 56 | 1528 | 长线型 / 易疲劳 / 穿透 / 高耐久 | mixed | 4 | 后期成长DoT高耐坦克，但RAMP第22回合封顶后进入40-84回合零伤害平台，“后期成长”名不副实。成长窗口后加疲劳段强制收束，并提升蚀爆消耗伤害（ATK低基数下1.39系数不足）让后期有击杀能力。 |
| 青岚 | A | 76 | 1399 | 高波动 / 易疲劳 / DoT / 高耐久 | fatigue | 0 | 青岚：展示逐步疲劳与高波动。行动组合：破咒、蚀爆、血性猛击、突袭；机制：dispel / status / consumeStatus / damage / conditional / selfDamagePct / shield / gain / repeat。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 孤峰 | A | 94 | 1006 | 稳定 / 易疲劳 / 穿透 / 高速 | fatigue | 4 | 高速高伤脆皮玻璃炮，但突袭依赖targetHasStatus(dot)而此dot全场无人施加，永远走else只囤CHRONO。镜像55回合0伤害、对C+反输。修正死机制：移除突袭对不存在dot的依赖并以CHRONO直接伤害，配合疲劳时钟。 |
| 曜甲 | A_PLUS | 25 | 764 | 稳定 / 易疲劳 / DoT / 高速 | fatigue | 1 | 高速雷系DoT消耗，镜像50回合0伤害。FATIGUE_CAP 0.6把ATK压到47.4平台。抬高ATK下限(0.78)让蚀爆/DoT能收尾。 |
| 熔芯 | A_PLUS | 45 | 1301 | 高波动 / 后期成长 / 吸血 / 高耐久 | ramp | 0 | 熔芯：展示延后成长与高波动。行动组合：复苏、净化、战意、蓄能、号令、血性猛击；机制：heal / repeat / conditional / cleanse / status / gain / toggleStatus / shield / resource / emitEvent / selfDamagePct / damage。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 渊鳞 | A_PLUS | 65 | 1596 | 稳定 / 后期成长 / 高回复 / 穿透 | ramp | 1 | 高回复穿透长线坦克，镜像54回合0伤害，自疗(0.19)远超条件式输出。下调主回血系数，让成长后的攻击能终结。 |
| 月镰 | A_PLUS | 85 | 3496 | 高波动 / 易疲劳 / DoT / 高速 | fatigue | 1 | 高速高暴击冰DoT刺客，镜像54回合0伤害，FATIGUE_CAP 0.37把ATK压到48.84。抬高ATK保留下限让高速DoT能终结。 |
| 疾电 | A_PLUS | 100 | 1446 | 长线型 / 易疲劳 / 吸血 / 高暴击 | mixed | 0 | 疾电：展示先成长后疲劳与中波动。行动组合：复苏、战意、血性猛击、战术；机制：conditional / heal / status / gain / repeat / toggleStatus / selfDamagePct / damage / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 苍翼 | S | 15 | 480 | 稳定 / 长线型 / 穿透 / 高耐久 | mixed | 4 | 先成长后疲劳、靠高防御墙拖长线，镜像79回合0进度。抬高终结技对DEF墙的系数并下调高低免死韧性，让疲劳后期仍能击杀。 |
| 绝刃 | S | 37 | 643 | 高波动 / 易疲劳 / DoT / 低爆发 | fatigue | 3 | 易疲劳低爆发DoT出血流，镜像81回合 heal 354>damage 177。削超越回复(0.18→0.10)、抬疲劳峰顶(0.54→0.72)并把DoT引爆转为有效DPS。 |
| 虹雉 | S | 57 | 1335 | 稳定 / 后期成长 / DoT / 高耐久 | ramp | 0 | 虹雉：展示延后成长与低波动。行动组合：蚀爆、血性猛击、蓄能；机制：status / consumeStatus / damage / conditional / selfDamagePct / gain / resource。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 怒涛 | S | 77 | 2532 | 易疲劳 / 高耐久 / DoT / 状态引爆 | fatigue | 0 | 怒涛：展示逐步疲劳与中波动。行动组合：侵蚀、蚀爆、破咒、战意；机制：conditional / status / gain / repeat / consumeStatus / damage / dispel / toggleStatus / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 暗星 | S | 95 | 3048 | 稳定 / 易疲劳 / DoT / 穿透 | fatigue | 4 | 高速稳定高耐久空手，镜像88回合0伤害。蚀爆被targetHp<0.4门控锁死而自愈/护盾让双方永不跌破。解除伤害门控、削减自愈，并提升蚀爆消耗伤害，让稳定穿透身份落地终结。 |
| 焚天 | SS | 26 | 1502 | 稳定 / 后期成长 / 穿透 / 高耐久 | ramp | 0 | 焚天：展示延后成长与低波动。行动组合：突袭、血性猛击、破咒、战意；机制：conditional / damage / status / gain / selfDamagePct / repeat / dispel / toggleStatus / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 渊影 | SS | 46 | 2623 | 长线型 / 高波动 / DoT / 慢速 | mixed | 5 | 慢速DoT高血坦克，镜像86回合0伤害平局。复苏0.24两次+冷却1+ENDURANCE89锁死。加装疲劳打破互奶锁、提高蚀爆消耗伤害、拉长复苏冷却。 |
| 棱镜 | SS | 66 | 5274 | 高波动 / 长线型 / DoT / 状态压制 | mixed | 4 | 资源循环低伤控制，蚀爆伤害+护盾锁在hpPctBelow<0.5，满血时永远走else，镜像50回合0伤害。解除伤害门控使其无条件耗蚀层造成伤害，并补轻度疲劳防无限刷CHRONO。 |
| 时尘 | SS | 86 | 4459 | 稳定 / 易疲劳 / DoT / 状态压制 | fatigue | 3 | 易疲劳DoT状态压制，镜像77回合仅36伤害。斩杀突袭被targetHp<0.4锁死。加强蚀爆消耗输出、加快疲劳、放宽突袭门槛到0.6。 |
| 血冕 | SS | 100 | 5196 | 高波动 / 长线型 / 高爆发 / DoT | mixed | 0 | 血冕：展示先成长后疲劳与高波动。行动组合：血性猛击、战术、突袭、蚀爆、回转、蓄能；机制：selfDamagePct / damage / status / gain / consumeStatus / shield / cooldownReduce / conditional / resource。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 穹顶 | SSS | 16 | 708 | 长线型 / 稳定 / DoT / 高耐久 | mixed | 2 | 高耐久护盾墙，镜像64回合伤害5 vs 治疗290 纯互磨。后期攻势归零。加速疲惫衰并降ENDURANCE，让晚局走向决定性终结。 |
| 极光 | SSS | 38 | 2071 | 高波动 / 后期成长 / 吸血 / 高速 | ramp | 0 | 极光：展示延后成长与高波动。行动组合：复苏、破咒、血性猛击、转化；机制：heal / status / repeat / dispel / selfDamagePct / damage / shield / convertResource。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 不朽 | SSS | 58 | 1257 | 稳定 / 后期成长 / 低爆发 / 护盾型 | ramp | 0 | 不朽：展示延后成长与低波动。行动组合：护符、血性猛击、净化、血性猛击；机制：ward / selfDamagePct / damage / shield / repeat / cleanse / conditional / gain。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 湮灭 | SSS | 78 | 2851 | 易疲劳 / 护盾型 / 高速 / 资源循环 | fatigue | 2 | 三连ward+stance减伤护盾墙，SS/SSS_COLLECTOR/镜像三场54回合且我方0伤害。加大并加深疲惫让晚局防护崩解、逼出胜负。 |
| 创世 | SSS | 96 | 8332 | 稳定 / 高耐久 / DoT / 状态引爆 | stable | 0 | 创世：展示稳定时间曲线与低波动。行动组合：血性猛击、蚀爆、回转、护符；机制：selfDamagePct / damage / status / consumeStatus / cooldownReduce / ward / gain。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 星冕 | SSS_COLLECTOR | 27 | 1741 | 稳定 / 长线型 / DoT / 穿透 | mixed | 0 | 星冕：展示先成长后疲劳与低波动。行动组合：回转、蓄能、蚀爆、血性猛击；机制：cooldownReduce / repeat / resource / gain / status / consumeStatus / damage / shield / selfDamagePct。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 晨辉 | SSS_COLLECTOR | 47 | 3270 | 高波动 / 长线型 / 防御型 / 吸血 | mixed | 0 | 晨辉：展示先成长后疲劳与高波动。行动组合：净化、号令、蚀爆；机制：cleanse / conditional / emitEvent / gain / status / consumeStatus / damage。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 虚影 | SSS_COLLECTOR | 67 | 2154 | 稳定 / 长线型 / DoT / 高速 | mixed | 2 | 第12回合起发力的后期成长DoT高速卡，FATIGUE_START=999永不疲劳，配合护盾第50-69回合互磨不出结果。保留1-30回合成长身份，其后启动疲劳让极限长线收束。 |
| 终焉 | SSS_COLLECTOR | 87 | 3059 | 易疲劳 / DoT / 穿透 / 护盾型 | fatigue | 2 | 易疲劳巨型护盾坦克（DEF475/ATK71），镜像79回合damage仅50。补足进攻转化：提升ATK与蚀爆消耗系数，让疲劳坦能兑现击杀。 |
| 幻梦 | SSS_COLLECTOR | 100 | 2418 | 稳定 / 长线型 / 穿透 / 高闪避 | mixed | 3 | 纯回复+护盾+反击超级高闪避耐久卡，镜像87回合DRAW、全部myDamage 0（最严重）。回收永动回复（复苏冷却2→4）、强化反击转化、加速疲劳，把无限平局变可收束消耗。 |
| 天陨 | XS | 17 | 2049 | 稳定 / DoT / 穿透 / 状态压制 | stable | 0 | 天陨：展示稳定时间曲线与低波动。行动组合：复苏、侵蚀、号令、蚀爆；机制：conditional / heal / gain / repeat / status / emitEvent / shield / consumeStatus / damage。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 深渊 | XS | 39 | 2813 | 高波动 / 长线型 / 高耐久 / 防御型 | mixed | 4 | 延后成长慢防御塔，镜像76回合0伤害、面板56-76回合全程0伤害。唯一输出被hp<0.5锁死。抬高输出动作优先级并绑定战斗时长（疲劳）终结僵持。 |
| 破晓 | XS | 59 | 1729 | 高波动 / 长线型 / 高耐久 / 资源循环 | mixed | 4 | 高耐久资源循环后期成长，镜像82回合0伤害，无任何直伤出口。降低ENDURANCE、给长期战争取损耗收尾，并提升唯一输出的反击转化。 |
| 永夜 | XS | 79 | 2839 | 高波动 / 易疲劳 / 高耐久 / 慢速 | fatigue | 0 | 永夜：展示逐步疲劳与高波动。行动组合：蓄能、血性猛击、破咒、复苏、回转、转化；机制：resource / repeat / selfDamagePct / damage / conditional / dispel / shield / gain / heal / status / cooldownReduce / convertResource。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 洪荒 | XS | 97 | 6043 | DoT / 高速 / 穿透 / 状态压制 | stable | 0 | 洪荒：展示稳定时间曲线与中波动。行动组合：蚀爆、侵蚀、战意、蓄能、复苏、破咒；机制：status / consumeStatus / damage / toggleStatus / resource / shield / conditional / heal / gain / dispel。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 泰初 | XS_COLLECTOR | 28 | 801 | 稳定 / 高耐久 / 护盾型 / 吸血 | stable | 0 | 泰初：展示稳定时间曲线与低波动。行动组合：护符、号令、转化、血性猛击、战意、坚守；机制：ward / emitEvent / shield / convertResource / status / repeat / conditional / selfDamagePct / damage / gain / toggleStatus。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 太虚 | XS_COLLECTOR | 48 | 1863 | 易疲劳 / 高波动 / 穿透 / DoT | fatigue | 0 | 太虚：展示逐步疲劳与高波动。行动组合：战意、战术、净化、蓄能、蚀爆、回转；机制：repeat / conditional / toggleStatus / gain / status / cleanse / resource / consumeStatus / damage / cooldownReduce。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 无极 | XS_COLLECTOR | 68 | 6961 | 稳定 / 长线型 / 穿透 / DoT | mixed | 3 | 后期成长高爆发DoT，但RAMP第1回合即满、FATIGUE无限，镜像/65回合磨活。注入第30回合起0.8封顶疲劳，让成长峰值后可收束。 |
| 混沌 | XS_COLLECTOR | 88 | 4062 | 高波动 / 易疲劳 / DoT / 高爆发 | fatigue | 0 | 混沌：展示逐步疲劳与高波动。行动组合：蚀爆、号令、护符、突袭、蓄能、坚守；机制：status / consumeStatus / damage / repeat / emitEvent / ward / gain / resource / conditional / shield。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |
| 涅槃 | XS_COLLECTOR | 100 | 10894 | 长线型 / 易疲劳 / 高爆发 / DoT | mixed | 0 | 涅槃：展示先成长后疲劳与中波动。行动组合：坚守、突袭、回转、蚀爆；机制：conditional / shield / gain / damage / repeat / cooldownReduce / status / consumeStatus。直接伤害与其他机制共同工作。具体强弱保留生成差异。（本轮逐张复审通过，无需调整。） |

## 长局说明（mirror ≥60 回合卡）

对称镜像（同一张卡打自己）中，双方数值完全相同，自给自足型卡必然以高回合平局收敛——这是对称性的固有结果，不是死循环（panel 对局全部有胜负，无 hard cap）。以下列出 mirror 回合最高的卡及判定：

| 名称 | 稀有度 | mirror 回合 | 判定 | 说明 |
|---|---|---:|---|---|
