import { _decorator, Color, Component, EventKeyboard, Graphics, input, Input, KeyCode, Layers, Node, UITransform, Vec2, Vec3 } from 'cc';
import { GAME_EVENT_FOOD_EATEN } from './GameEvents';

const { ccclass, property } = _decorator;

/**
 * 控制贪吃蛇头部节点，使用 WASD 键进行移动。
 */
@ccclass('SnakeHeadController')
export class SnakeHeadController extends Component {
    @property
    public moveSpeed = 200;

    @property({ type: Color, tooltip: '蛇身方块颜色。' })
    public bodyColor: Color = new Color(110, 220, 120, 255);

    private readonly _moveDirection: Vec3 = new Vec3(0, 0, 0);
    private readonly _bodySegments: Node[] = [];
    private readonly _headPath: Vec3[] = [];
    private _eventNode: Node | null = null;
    private _segmentGap = 32;

    /**
     * 组件加载后注册键盘输入监听。
     */
    onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.bindFoodEatenEvent();
        this.initializeBodyPath();
    }

    /**
     * 组件销毁前注销键盘输入监听。
     */
    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.unbindFoodEatenEvent();

        // 蛇身节点不是蛇头子节点，需要手动回收避免场景残留。
        for (const segmentNode of this._bodySegments) {
            if (segmentNode.isValid) {
                segmentNode.destroy();
            }
        }
        this._bodySegments.length = 0;
        this._headPath.length = 0;
    }

    /**
     * 每帧根据当前方向移动蛇头。
     * @param deltaTime 当前帧与上一帧之间的时间间隔（秒）
     */
    update(deltaTime: number): void {
        if (this._moveDirection.lengthSqr() === 0) {
            return;
        }

        const currentPos = this.node.position;
        const nextX = currentPos.x + this._moveDirection.x * this.moveSpeed * deltaTime;
        const nextY = currentPos.y + this._moveDirection.y * this.moveSpeed * deltaTime;

        // 按方向、速度和帧间隔计算位移，保证不同帧率下移动速度一致。
        this.node.setPosition(nextX, nextY, currentPos.z);

        this.recordHeadPath(nextX, nextY, currentPos.z);
        this.updateBodyFollowByPath();
        this.trimHeadPath();
    }

    /**
     * 处理键盘按下事件，并更新移动方向。
     * @param event 键盘事件
     */
    private onKeyDown(event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
                this._moveDirection.set(0, 1, 0);
                break;
            case KeyCode.KEY_S:
                this._moveDirection.set(0, -1, 0);
                break;
            case KeyCode.KEY_A:
                this._moveDirection.set(-1, 0, 0);
                break;
            case KeyCode.KEY_D:
                this._moveDirection.set(1, 0, 0);
                break;
        }
    }

    /**
     * 处理键盘抬起事件，仅在抬起当前方向按键时停止移动。
     * @param event 键盘事件
     */
    private onKeyUp(event: EventKeyboard): void {
        // 只在释放“当前生效方向”对应的按键时停止，避免多键切换时误停。
        if (event.keyCode === KeyCode.KEY_W && this._moveDirection.y > 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_S && this._moveDirection.y < 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_A && this._moveDirection.x < 0) {
            this._moveDirection.set(0, 0, 0);
            return;
        }

        if (event.keyCode === KeyCode.KEY_D && this._moveDirection.x > 0) {
            this._moveDirection.set(0, 0, 0);
        }
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
        if (eatenCount <= this._bodySegments.length) {
            return;
        }

        const parentNode = this.node.parent;
        if (!parentNode) {
            return;
        }

        while (this._bodySegments.length < eatenCount) {
            const segmentIndex = this._bodySegments.length + 1;
            const spawnPosition = this.samplePathPosition(this._segmentGap * segmentIndex);
            const bodySegmentNode = this.createBodySegment(parentNode, spawnPosition);
            this._bodySegments.push(bodySegmentNode);
        }
    }

    /**
     * 初始化蛇身跟随参数：
     * 1. 蛇节间距固定取蛇头尺寸（最短边）；
     * 2. 轨迹缓存以蛇头当前位置为起点。
     */
    private initializeBodyPath(): void {
        const headTransform = this.node.getComponent(UITransform);
        if (headTransform) {
            const headSize = headTransform.contentSize;
            this._segmentGap = Math.max(1, Math.min(headSize.width, headSize.height));
        }

        const headPos = this.node.position;
        this._headPath.length = 0;
        this._headPath.push(new Vec3(headPos.x, headPos.y, headPos.z));
    }

    /**
     * 记录蛇头轨迹点，仅在位置发生变化时追加。
     * @param x 蛇头 x 坐标
     * @param y 蛇头 y 坐标
     * @param z 蛇头 z 坐标
     */
    private recordHeadPath(x: number, y: number, z: number): void {
        const lastPoint = this._headPath[this._headPath.length - 1];
        if (!lastPoint) {
            this._headPath.push(new Vec3(x, y, z));
            return;
        }

        const deltaX = x - lastPoint.x;
        const deltaY = y - lastPoint.y;
        const deltaZ = z - lastPoint.z;
        const distanceSqr = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
        if (distanceSqr <= 0.000001) {
            return;
        }

        this._headPath.push(new Vec3(x, y, z));
    }

    /**
     * 基于蛇头轨迹更新蛇身跟随，使相邻蛇节间距恒定为蛇头尺寸。
     */
    private updateBodyFollowByPath(): void {
        for (let index = 0; index < this._bodySegments.length; index++) {
            const segmentNode = this._bodySegments[index];
            const targetDistance = this._segmentGap * (index + 1);
            const targetPos = this.samplePathPosition(targetDistance);
            segmentNode.setPosition(targetPos.x, targetPos.y, targetPos.z);
        }
    }

    /**
     * 在蛇头轨迹上按距离采样位置。
     * @param distanceFromHead 目标点与蛇头的路径距离
     */
    private samplePathPosition(distanceFromHead: number): Vec3 {
        if (this._headPath.length === 0) {
            const headPos = this.node.position;
            return new Vec3(headPos.x, headPos.y, headPos.z);
        }

        if (this._headPath.length === 1) {
            const onlyPoint = this._headPath[0];
            return new Vec3(onlyPoint.x, onlyPoint.y, onlyPoint.z);
        }

        let remainingDistance = distanceFromHead;

        for (let index = this._headPath.length - 1; index > 0; index--) {
            const newerPoint = this._headPath[index];
            const olderPoint = this._headPath[index - 1];

            const deltaX = olderPoint.x - newerPoint.x;
            const deltaY = olderPoint.y - newerPoint.y;
            const deltaZ = olderPoint.z - newerPoint.z;
            const segmentLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
            if (segmentLength <= 0.000001) {
                continue;
            }

            if (segmentLength >= remainingDistance) {
                const lerpRatio = remainingDistance / segmentLength;
                return new Vec3(
                    newerPoint.x + deltaX * lerpRatio,
                    newerPoint.y + deltaY * lerpRatio,
                    newerPoint.z + deltaZ * lerpRatio,
                );
            }

            remainingDistance -= segmentLength;
        }

        const oldestPoint = this._headPath[0];
        return new Vec3(oldestPoint.x, oldestPoint.y, oldestPoint.z);
    }

    /**
     * 限制轨迹缓存长度，避免长时间运行后无上限增长。
     */
    private trimHeadPath(): void {
        const requiredDistance = this._segmentGap * Math.max(4, this._bodySegments.length + 2);
        let accumulatedDistance = 0;
        let cutIndex = -1;

        for (let index = this._headPath.length - 1; index > 0; index--) {
            const newerPoint = this._headPath[index];
            const olderPoint = this._headPath[index - 1];
            const deltaX = olderPoint.x - newerPoint.x;
            const deltaY = olderPoint.y - newerPoint.y;
            const deltaZ = olderPoint.z - newerPoint.z;
            const segmentLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

            accumulatedDistance += segmentLength;
            if (accumulatedDistance > requiredDistance) {
                cutIndex = index - 1;
                break;
            }
        }

        if (cutIndex > 0) {
            this._headPath.splice(0, cutIndex);
        }
    }

    /**
     * 创建单个蛇身节点（绿色方块）并放置到指定位置。
     * @param parentNode 蛇身挂载父节点（通常是 Canvas）
     * @param initialPosition 初始位置
     */
    private createBodySegment(parentNode: Node, initialPosition: Readonly<Vec3>): Node {
        const segmentNode = new Node(`snake_body_${this._bodySegments.length + 1}`);
        segmentNode.layer = Layers.Enum.UI_2D;
        segmentNode.parent = parentNode;

        const segmentTransform = segmentNode.addComponent(UITransform);
        const segmentSize = this._segmentGap;
        segmentTransform.setContentSize(segmentSize, segmentSize);
        segmentTransform.anchorPoint = new Vec2(0.5, 0.5);

        const segmentGraphics = segmentNode.addComponent(Graphics);
        segmentGraphics.clear();
        segmentGraphics.fillColor = new Color(this.bodyColor.r, this.bodyColor.g, this.bodyColor.b, this.bodyColor.a);

        const halfSize = segmentSize * 0.5;
        // 以锚点中心绘制方块，便于位置跟随逻辑复用。
        segmentGraphics.rect(-halfSize, -halfSize, segmentSize, segmentSize);
        segmentGraphics.fill();

        segmentNode.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
        return segmentNode;
    }
}
