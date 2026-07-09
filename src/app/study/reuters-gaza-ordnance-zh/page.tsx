import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "中文版镜像 · 加沙未爆弹 | 排版学习",
  description: "基于 Reuters Graphics 原文整理的中文长页镜像，用于学习新闻图形与 editorial 排版。",
};

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-950 mt-16 mb-6">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.95] text-neutral-800 mb-6">{children}</p>;
}

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-12">
      <img src={src} alt={alt} className="w-full h-auto border border-neutral-200" />
      <figcaption className="mt-3 text-[12px] leading-6 text-neutral-500">{caption}</figcaption>
    </figure>
  );
}

function DataBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="my-10 border-t border-b border-neutral-300 py-5">
      <div className="text-[12px] tracking-[0.12em] uppercase text-neutral-500 mb-3">原文图形要点</div>
      <h3 className="text-xl font-semibold text-neutral-950 mb-3">{title}</h3>
      <div className="space-y-3 text-[16px] leading-8 text-neutral-800">{children}</div>
    </section>
  );
}

export default function ReutersGazaOrdanceZhPage() {
  return (
    <main className="h-full overflow-y-auto bg-[#f6f3ec] text-neutral-950">
      <article className="mx-auto max-w-[1200px] px-5 md:px-8 pb-24">
        <header className="pt-10 md:pt-14 border-b border-neutral-300 pb-10">
          <Kicker>Study Mirror · Reuters Graphics · Chinese Reading Version</Kicker>
          <div className="grid md:grid-cols-[minmax(0,1fr)_320px] gap-8 items-end mt-4">
            <div>
              <h1 className="text-5xl md:text-7xl leading-[0.95] font-semibold tracking-[-0.03em] text-neutral-950 max-w-[10ch]">
                加沙人如何在未爆炸弹之间生存
              </h1>
              <p className="mt-6 text-xl md:text-2xl leading-[1.6] text-neutral-700 max-w-[34em]">
                美国政府称，加沙地带已“无法居住”。数万次空袭留下的大量未爆弹散落其间，而清理工作几乎停滞。
              </p>
            </div>
            <aside className="md:pl-6 md:border-l md:border-neutral-300 text-[13px] leading-7 text-neutral-600">
              <div>原始网页：Reuters Graphics</div>
              <div>用途：排版学习用中文镜像页</div>
              <div>说明：保留长篇网页阅读形态，中文内容为人工整理与意译，并未复刻全部交互图形。</div>
              <div className="mt-3 text-neutral-900">
                <a className="underline underline-offset-4" href="https://www.reuters.com/graphics/ISRAEL-PALESTINIANS/GAZA-ORDNANCE/byvrxbenwve/" target="_blank" rel="noreferrer">
                  打开原始英文页面
                </a>
              </div>
            </aside>
          </div>
        </header>

        <Figure
          src="https://www.reuters.com/graphics/ISRAEL-PALESTINIANS/GAZA-ORDNANCE/byvrxbenwve/cdn/images/mk84A.jpg"
          alt="加沙汗尤尼斯地面上的未爆炸弹"
          caption="汗尤尼斯地面上的一枚未爆炸弹。原图：Reuters。"
        />

        <section className="grid md:grid-cols-[minmax(0,760px)_1fr] gap-10">
          <div className="max-w-none">
            <P>
              今年 2 月，美国总统特朗普提出由美国“接管”加沙，并负责清除未爆炸弹与其他武器，把这里改造成“中东的里维埃拉”。但路透的这篇图形报道指出：要清理这些致命遗留物，难度极其巨大，而且此前从未被如此详细地梳理过。
            </P>
            <P>
              1 月停火破裂后，以色列在 3 月恢复轰炸。联合国称，这轮攻势已使这片狭小飞地三分之二的区域被控制、清空或人口外流。炸弹每天仍在落下。以军称，截至 2024 年 10 月，以色列已对加沙实施超过 4 万次空袭。联合国地雷行动处估计，射向加沙的炸弹中，大约每 10 枚到 20 枚里就有 1 枚没有爆炸。
            </P>

            <DataBox title="原文开场图形：加沙常见美制炸弹">
              <p>报道首先用长卷式图形介绍了 Mark 82、Mark 83、Mark 84 等炸弹，以及“哑弹”、JDAM、SPICE 导引套件、小直径炸弹等概念。</p>
              <p>其中 Mark 84 是 2,000 磅级航空炸弹，约 910 千克，内部装药超过 880 磅，足以穿透混凝土和金属并造成大范围爆炸。</p>
              <p>原文借这组图形建立了一个关键信息：加沙废墟中的危险不是抽象概念，而是具体、沉重、可识别的工业武器系统。</p>
            </DataBox>

            <P>
              停火后不久，加沙本地已经开始清理工作。在汗尤尼斯附近，一名推土机司机阿拉·阿布·朱迈扎在清理道路时，铲刃碰到了一枚隐藏的炸弹。事发时，15 岁的赛义德·阿卜杜勒·加富尔正在旁边玩耍。
            </P>
            <P>
              “火焰和高温一下子把我们吞没了。”这名男孩对路透表示。他说自己失去了一只眼睛的视力。司机朱迈扎也失去一只眼睛，并在手脚上留下烧伤和弹片伤。
            </P>
            <P>
              根据联合国机构与 NGO 在加沙建立的数据库，自 2023 年 10 月 7 日战争开始以来，至少已有 23 人死于遗弃或未爆弹药，另有 162 人受伤。援助人员强调，这很可能只是总量的一小部分，因为许多受害者甚至不知道该如何上报事故。
            </P>
            <P>
              哈马斯表示，它曾回收部分未爆弹用于对付以色列，但也愿意与国际机构合作清除这些武器。问题在于，国际排爆组织想进入加沙开展工作，往往会被以色列设置的进口限制所阻挡——许多可能被视为“军民两用”的设备根本无法进入。
            </P>

            <DataBox title="原文图形：哪些排爆设备被限制进入">
              <p>路透在这里插入了一张设备图解，列出去年 3 月到 7 月间被以方拒绝入境的排爆器材：从望远镜、装甲车辆，到引爆导线等，总计超过 2,000 件。</p>
              <p>这类图形不是在“装饰”报道，而是在把抽象的行政阻碍翻译成可被普通读者理解的物件清单。</p>
            </DataBox>

            <P>
              联合国人权办公室发言人杰里米·劳伦斯对路透说，由于以色列当局限制必要设备进入，清除程序尚未真正开始。这给参与救援的人员造成了“严重且不必要的挑战”。
            </P>
            <P>
              联合国人权办公室和红十字国际委员会指出，根据 1907 年《海牙公约》，作为占领方，以色列有义务移除或协助移除危及平民生命的战争遗留物。尽管以色列不是该公约缔约方，红十字国际委员会首席法律官表示，以方也承认这属于习惯国际法上的约束。
            </P>
            <P>
              以色列军方以安全原因拒绝说明其在加沙使用了哪些弹药，也没有回应遗留未爆弹规模的问题。负责监督对加沙运输的以军机构 COGAT，也未回应其在清理行动中扮演何种角色。美国国家安全委员会则表示，一再强调加沙已“无法居住”，让加沙人在未爆弹中生活是不人道的。
            </P>
            <P>
              参与联合国协调讨论的 7 名武器专家告诉路透，由于尚未进行全面勘查，现在还无法估算加沙究竟有多少未爆弹药。联合国地雷行动处说，他们的处置队伍已在地表发现数百件战争遗留弹药，包括航空炸弹、迫击炮弹、火箭弹和简易爆炸装置；更多弹体则可能掩埋在瓦砾下，或深埋地下。
            </P>
            <P>
              路透记者在加沙城的垃圾堆上发现一枚超过一米长的炸弹；在努赛赖特，一名男子说，由于当局无法移走家中的炸弹，他只能住在难民营；在汗尤尼斯，还有居民继续住在建筑物里，而警方与地方官员认为，楼下沙层中埋着一枚未爆弹。
            </P>
            <P>
              即便以色列完全配合，联合国机构与 NGO 组成的“保护集群”在去年 12 月发布的文件中仍估计：要清除这些炸弹，可能需要 10 年时间与 5 亿美元成本。
            </P>

            <P>
              联合国环境规划署还指出，废墟之中不仅有爆炸物，还有石棉与其他污染物；与此同时，根据巴勒斯坦卫生部的数据，废墟下还埋着成千上万具巴勒斯坦人的遗体。
            </P>
            <P>
              地雷咨询组织（MAG）项目主管格雷格·克劳瑟说，加沙的损毁程度像一场巨大的地震，而更糟的是，地震中心还夹杂着成千上万枚炸弹。“重建本来就是极其漫长的过程，而这些物件会让一切更加拖延。”
            </P>

            <SectionTitle>数以千计的哑弹</SectionTitle>
            <P>
              如果以以色列公开声称的 4 万次空袭为基准，按 10% 的失效率推算，即使每次空袭只投下一枚炸弹，也意味着大约有 4,000 枚哑弹遗留在加沙。这还不包括海上、地面攻击造成的遗留物，也不包括哈马斯及其盟友留下的武器。
            </P>
            <P>
              一些专家认为，在城市区域，失效率可能比“十分之一”更高。因为炸弹在穿透多层建筑，尤其是已经受损的建筑时，并不总会正常引爆。
            </P>

            <DataBox title="原文图形：炸弹为什么会失效">
              <p>这部分原稿用剖面图比较了硬地面爆炸与软地面失效的区别：当重型炸弹落入深沙、废墟层或穿透建筑结构后，可能深埋地下而未立即引爆。</p>
              <p>这类图示非常适合你学习：它把“技术解释”压缩成单张可读版面，兼顾文字、图像与动线。</p>
            </DataBox>

            <P>
              从业 30 年、曾在伊拉克、叙利亚、乌克兰和黎巴嫩排雷的爆炸物处理专家加里·图姆斯说：“这是我见过技术上最困难、同时人道处境最糟糕的情况。”他形容，这项任务“将极其艰难”。
            </P>
            <P>
              路透援引 ACLED 数据指出，自战争开始以来，加沙几乎每天都遭到空袭。数据库记录了超过 8,000 个空袭“事件”；一个事件里又可能包含多次具体打击。ACLED 说，到 2024 年底，以色列对加沙的空袭数量，已超过 2016 到 2017 年伊拉克摩苏尔战役中美军领导联军空袭量的九倍。
            </P>

            <DataBox title="原文图形：40,300 个目标的规模感">
              <p>原网页在此使用了一个非常典型的 Reuters 长页数据图：把“4 万多个目标”转成一整页滚动可感知的数量堆叠。</p>
              <p>这类图形的排版价值在于：它不只是告诉你数字大，而是让“规模”成为一种身体经验——读者在滚动中亲自感受到数量的压迫。</p>
            </DataBox>

            <P>
              巴勒斯坦警方说，他们缺乏安全清理瓦砾所需的设备。哈马斯控制的政府媒体办公室负责人称，负责清除武器的警察工程部门已有 31 人死亡、22 人受伤，其中一些人在拆弹时遇难。发生推土机爆炸事故的卡拉拉镇镇长则呼吁国际队伍前来协助。
            </P>
            <P>
              但这些组织表示，他们需要以色列批准专家签证、装甲车辆、炸药，以及用于挖掘深埋炸弹的隧道设备。眼下，排爆人员所能做的更多只是标记危险物，尽力避免事故，尤其是防止儿童误触。慈善机构制作的壁画和海报上，常用彩色气球吸引孩子注意，再把炸弹、骷髅头与警告语放在一起。
            </P>

            <SectionTitle>Mark 84</SectionTitle>
            <P>
              加沙使用过的最重型炸弹属于 Mark 80 系列，其中最大的 Mark 84 为 2,000 磅级美制航空炸弹。第一次海湾战争期间，美国飞行员曾把它称作“铁锤”。
            </P>
            <P>
              拜登政府曾向以色列运送数千枚 Mark 84，后因担心平民风险一度暂停，但这一暂停后来被特朗普撤销。路透记者在汗尤尼斯的废墟中发现两枚 Mark 80 系列炸弹，周围仅用红白警戒带围住。三名武器专家根据现场图片判断，它们看起来像 Mark 84，但若不测量，仍无法百分之百确认。
            </P>

            <SectionTitle>与炸弹同住</SectionTitle>
            <P>
              49 岁的学校教师哈尼·阿尔·阿巴德拉在 1 月停火后返回位于汗尤尼斯的家，发现一枚不明炸弹穿透了三层楼却没有爆炸。市政官员和警方爆炸物工程部门认为，这枚炸弹如今可能埋在他家走廊下方几米深的沙层中。
            </P>

            <Figure
              src="https://www.reuters.com/graphics/ISRAEL-PALESTINIANS/GAZA-ORDNANCE/byvrxbenwve/cdn/images/hole.jpg"
              alt="警方与官员查看疑似埋有未爆弹的住宅区域"
              caption="警方爆炸物工程人员和官员站在一处住宅内，他们认为这里下方埋着一枚未爆炸弹。原图：Reuters。"
            />

            <P>
              三名武器处理专家说，像 Mark 84 这样的重型炸弹确实可能深深扎入沙层；但他们也指出，在阿巴德拉返回前，它也可能已经被移走，甚至被武装组织重新回收利用。
            </P>
            <P>
              阿巴德拉说，妻子和孩子因为害怕拒绝回家住。但对他来说，和兄弟住在这栋受损房屋里、与疑似炸弹共处，也比回到冰冷的帐篷里更能接受。他睡在二楼，兄弟睡在三楼。
            </P>
            <P>
              “没人敢进来。”他说，“我们现在尽量待在高层，离这个战争遗留物远一点。”
            </P>
          </div>

          <aside className="hidden md:block pt-2">
            <div className="sticky top-0 space-y-8">
              <div className="border-l border-neutral-300 pl-5">
                <div className="text-[12px] uppercase tracking-[0.14em] text-neutral-500 mb-2">阅读提示</div>
                <p className="text-[14px] leading-7 text-neutral-700">
                  这个镜像页的目标不是替代原作，而是让你在中文语境下观察标题层级、长文节奏、图文关系与信息分隔方式。
                </p>
              </div>
              <div className="border-l border-neutral-300 pl-5">
                <div className="text-[12px] uppercase tracking-[0.14em] text-neutral-500 mb-2">建议你观察</div>
                <ul className="text-[14px] leading-8 text-neutral-700 list-disc pl-4">
                  <li>标题、导语、正文的字号关系</li>
                  <li>每个“图形要点框”如何承担结构切换</li>
                  <li>长段落之间是否需要引文、数据块或图片缓冲</li>
                  <li>图片说明文字如何退后但不消失</li>
                </ul>
              </div>
              <div className="border-l border-neutral-300 pl-5">
                <div className="text-[12px] uppercase tracking-[0.14em] text-neutral-500 mb-2">原文元信息</div>
                <p className="text-[14px] leading-7 text-neutral-700">
                  Reuters 于 2025-04-17 发布。作者包括 Emma Farge、Adolfo Arranz、Han Huang、Simon Scarr、Nidal al-Mughrabi。
                </p>
              </div>
            </div>
          </aside>
        </section>
      </article>
    </main>
  );
}
