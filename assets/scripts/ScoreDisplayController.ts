import { _decorator, Component, Label, Layers, Node, UITransform, Vec2 } from 'cc';
import { GAME_EVENT_FOOD_EATEN } from './GameEvents';

const { ccclass, property } = _decorator;

/**
 * 分数显示组件：
 * 监听 `food-eaten` 事件并在 Canvas 上实时更新分数文本。
 */
@ccclass('ScoreDisplayController')
export class ScoreDisplayController extends Component {
    @property({ tooltip: '分数前缀文本。' })
    public scorePrefix = 'Score';

    @property({ tooltip: '左侧边距（像素）。' })
    public marginLeft = 24;

    @property({ tooltip: '顶部边距（像素）。' })
    public marginTop = 24;

    @property({ tooltip: '分数字体大小。' })
    public fontSize = 36;

    private _score = 0;
    private _scoreLabel: Label | null = null;

    /**
     * 组件加载时准备分数文本节点。
     */
    onLoad(): void {
        this.ensureScoreLabel();
        this.renderScoreText();
    }

    /**
     * 组件启用后开始监听吃食物事件。
     */
    onEnable(): void {
        this.node.on(GAME_EVENT_FOOD_EATEN, this.onFoodEaten, this);
    }

    /**
     * 组件禁用后移除事件监听。
     */
    onDisable(): void {
        this.node.off(GAME_EVENT_FOOD_EATEN, this.onFoodEaten, this);
    }

    /**
     * 重置分数显示，通常在新一局开始时调用。
     */
    public resetScore(): void {
        this._score = 0;
        this.renderScoreText();
    }

    /**
     * 处理食物被吃事件并刷新文本。
     * @param eatenCount 累计吃到食物数量
     */
    private onFoodEaten(eatenCount: number): void {
        this._score = eatenCount;
        this.renderScoreText();
    }

    /**
     * 确保存在分数文本节点；如果场景里没有就运行时自动创建。
     */
    private ensureScoreLabel(): void {
        const existingNode = this.node.getChildByName('score_label');
        if (existingNode) {
            const existingLabel = existingNode.getComponent(Label);
            if (existingLabel) {
                this._scoreLabel = existingLabel;
                this.alignScoreLabel(existingNode);
                this.applyLabelStyle(existingLabel);
                return;
            }
        }

        const scoreNode = new Node('score_label');
        scoreNode.layer = Layers.Enum.UI_2D;
        scoreNode.parent = this.node;

        const scoreTransform = scoreNode.addComponent(UITransform);
        scoreTransform.setContentSize(320, 60);
        scoreTransform.anchorPoint = new Vec2(0, 1);

        const scoreLabel = scoreNode.addComponent(Label);
        this._scoreLabel = scoreLabel;
        this.applyLabelStyle(scoreLabel);
        this.alignScoreLabel(scoreNode);
    }

    /**
     * 应用分数文本样式。
     * @param label 文本组件
     */
    private applyLabelStyle(label: Label): void {
        label.fontSize = this.fontSize;
        label.lineHeight = this.fontSize + 6;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
    }

    /**
     * 将分数节点定位到 Canvas 左上角附近。
     * @param scoreNode 分数节点
     */
    private alignScoreLabel(scoreNode: Node): void {
        const boardTransform = this.node.getComponent(UITransform);
        if (!boardTransform) {
            return;
        }

        const boardSize = boardTransform.contentSize;
        const boardAnchor = boardTransform.anchorPoint;
        const left = -boardSize.width * boardAnchor.x;
        const top = boardSize.height * (1 - boardAnchor.y);

        scoreNode.setPosition(left + this.marginLeft, top - this.marginTop, 0);
    }

    /**
     * 刷新分数字符串。
     */
    private renderScoreText(): void {
        if (!this._scoreLabel) {
            return;
        }

        this._scoreLabel.string = `${this.scorePrefix}: ${this._score}`;
    }
}

