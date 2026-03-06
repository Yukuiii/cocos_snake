import { _decorator, Color, Component, Node, UITransform, Vec3 } from 'cc';
import { GAME_EVENT_FOOD_EATEN, GAME_EVENT_SNAKE_DIED } from './GameEvents';
import { SnakeBodyManager } from './SnakeBodyManager';
import { SnakeKeyboardInput } from './SnakeKeyboardInput';

const { ccclass, property } = _decorator;

/**
 * 蛇头控制门面组件：
 * 1. 负责协调输入、蛇头移动与死亡判定；
 * 2. 将蛇身增长与轨迹跟随委托给蛇身管理器；
 * 3. 保持对外 `resetState()` 接口不变，兼容现有游戏流程。
 */
@ccclass('SnakeHeadController')
export class SnakeHeadController extends Component {
    @property
    public moveSpeed = 200;

    @property({ type: Color, tooltip: '蛇身方块颜色。' })
    public bodyColor: Color = new Color(110, 220, 120, 255);

    private readonly _initialPosition: Vec3 = new Vec3();
    private _eventNode: Node | null = null;
    private _keyboardInput: SnakeKeyboardInput | null = null;
    private _bodyManager: SnakeBodyManager | null = null;

    /**
     * 组件加载后初始化输入控制与蛇身管理。
     */
    onLoad(): void {
        this._keyboardInput = new SnakeKeyboardInput();
        this._keyboardInput.bind();
        this._bodyManager = new SnakeBodyManager(this.node, () => this.bodyColor);
        this.bindFoodEatenEvent();
        this.captureInitialPosition();
        this._bodyManager.initialize();
    }

    /**
     * 组件销毁前释放输入监听、事件监听与蛇身节点。
     */
    onDestroy(): void {
        this._keyboardInput?.unbind();
        this._keyboardInput = null;
        this.unbindFoodEatenEvent();
        this._bodyManager?.destroy();
        this._bodyManager = null;
    }

    /**
     * 每帧根据当前方向移动蛇头。
     * @param deltaTime 当前帧与上一帧之间的时间间隔（秒）
     */
    update(deltaTime: number): void {
        const moveDirection = this._keyboardInput?.moveDirection;
        if (!moveDirection || moveDirection.lengthSqr() === 0) {
            return;
        }

        const currentPos = this.node.position;
        const nextX = currentPos.x + moveDirection.x * this.moveSpeed * deltaTime;
        const nextY = currentPos.y + moveDirection.y * this.moveSpeed * deltaTime;

        // 使用“下一帧位置”提前做边界判定，命中后直接结束当前局，避免蛇身轨迹继续写入错误数据。
        if (this.isTouchingBoardBoundary(nextX, nextY)) {
            this.notifySnakeDied();
            return;
        }

        // 按方向、速度和帧间隔计算位移，保证不同帧率下移动速度一致。
        this.node.setPosition(nextX, nextY, currentPos.z);
        this._bodyManager?.handleHeadMoved(nextX, nextY, currentPos.z);
    }

    /**
     * 将蛇恢复到开局状态：
     * 1. 回到初始位置；
     * 2. 停止当前移动；
     * 3. 清空蛇身与轨迹缓存。
     */
    public resetState(): void {
        this._keyboardInput?.resetDirection();
        this.node.setPosition(this._initialPosition.x, this._initialPosition.y, this._initialPosition.z);
        this._bodyManager?.reset();
    }

    /**
     * 监听 Canvas 上的 `food-eaten` 事件，驱动蛇身增长。
     */
    private bindFoodEatenEvent(): void {
        const eventNode = this.node.parent;
        if (!eventNode) {
            return;
        }

        this._eventNode = eventNode;
        this._eventNode.on(GAME_EVENT_FOOD_EATEN, this.onFoodEaten, this);
    }

    /**
     * 移除 `food-eaten` 事件监听。
     */
    private unbindFoodEatenEvent(): void {
        if (!this._eventNode) {
            return;
        }

        this._eventNode.off(GAME_EVENT_FOOD_EATEN, this.onFoodEaten, this);
        this._eventNode = null;
    }

    /**
     * 处理食物被吃事件，并把蛇身长度补齐到吃到数量。
     * @param eatenCount 累计吃到食物数量
     */
    private onFoodEaten(eatenCount: number): void {
        this._bodyManager?.syncBodyLength(eatenCount);
    }

    /**
     * 记录开局时的蛇头位置，供重开时复位使用。
     */
    private captureInitialPosition(): void {
        const initialPosition = this.node.position;
        this._initialPosition.set(initialPosition.x, initialPosition.y, initialPosition.z);
    }

    /**
     * 判断蛇头下一帧是否触碰到棋盘边界。
     * @param nextX 蛇头下一帧中心点 x 坐标
     * @param nextY 蛇头下一帧中心点 y 坐标
     */
    private isTouchingBoardBoundary(nextX: number, nextY: number): boolean {
        const boardNode = this.node.parent;
        if (!boardNode) {
            return false;
        }

        const boardTransform = boardNode.getComponent(UITransform);
        const headTransform = this.node.getComponent(UITransform);
        if (!boardTransform || !headTransform) {
            return false;
        }

        const boardSize = boardTransform.contentSize;
        const boardAnchor = boardTransform.anchorPoint;
        const boardLeft = -boardSize.width * boardAnchor.x;
        const boardRight = boardSize.width * (1 - boardAnchor.x);
        const boardBottom = -boardSize.height * boardAnchor.y;
        const boardTop = boardSize.height * (1 - boardAnchor.y);

        const headSize = headTransform.contentSize;
        const headAnchor = headTransform.anchorPoint;
        const headLeft = nextX - headSize.width * headAnchor.x;
        const headRight = nextX + headSize.width * (1 - headAnchor.x);
        const headBottom = nextY - headSize.height * headAnchor.y;
        const headTop = nextY + headSize.height * (1 - headAnchor.y);

        // 用户要求“触碰边界即死亡”，因此这里使用 <= / >=，而不是仅检测越界。
        return headLeft <= boardLeft || headRight >= boardRight || headBottom <= boardBottom || headTop >= boardTop;
    }

    /**
     * 抛出蛇死亡事件，交给游戏控制器负责重新开局。
     */
    private notifySnakeDied(): void {
        const eventNode = this._eventNode ?? this.node.parent;
        if (!eventNode) {
            return;
        }

        this._keyboardInput?.resetDirection();
        eventNode.emit(GAME_EVENT_SNAKE_DIED);
    }
}
