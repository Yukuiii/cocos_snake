import { Color, Graphics, Layers, Node, UITransform, Vec2, Vec3 } from 'cc';

/**
 * 蛇身管理器：
 * 1. 管理蛇身节点的创建、销毁与长度同步；
 * 2. 记录蛇头轨迹，并驱动蛇身沿轨迹跟随；
 * 3. 对外暴露初始化、移动同步、复位与销毁能力。
 */
export class SnakeBodyManager {
    private readonly _bodySegments: Node[] = [];
    private readonly _headPath: Vec3[] = [];
    private _segmentGap = 32;

    public constructor(
        private readonly _headNode: Node,
        private readonly _getBodyColor: () => Readonly<Color>,
    ) {}

    /**
     * 以蛇头当前位置初始化蛇身跟随参数。
     */
    public initialize(): void {
        this.initializeBodyPath();
    }

    /**
     * 在蛇头移动完成后同步轨迹与蛇身位置。
     * @param x 蛇头当前 x 坐标
     * @param y 蛇头当前 y 坐标
     * @param z 蛇头当前 z 坐标
     */
    public handleHeadMoved(x: number, y: number, z: number): void {
        this.recordHeadPath(x, y, z);
        this.updateBodyFollowByPath();
        this.trimHeadPath();
    }

    /**
     * 将蛇身长度补齐到目标长度。
     * @param targetLength 目标蛇身节数
     */
    public syncBodyLength(targetLength: number): void {
        if (targetLength <= this._bodySegments.length) {
            return;
        }

        const parentNode = this._headNode.parent;
        if (!parentNode) {
            return;
        }

        while (this._bodySegments.length < targetLength) {
            const segmentIndex = this._bodySegments.length + 1;
            const spawnPosition = this.samplePathPosition(this._segmentGap * segmentIndex);
            const bodySegmentNode = this.createBodySegment(parentNode, spawnPosition);
            this._bodySegments.push(bodySegmentNode);
        }
    }

    /**
     * 将蛇身恢复到开局状态。
     */
    public reset(): void {
        this.destroyBodySegments();
        this.initializeBodyPath();
    }

    /**
     * 销毁当前管理的蛇身节点与轨迹缓存。
     */
    public destroy(): void {
        this.destroyBodySegments();
        this._headPath.length = 0;
    }

    /**
     * 初始化蛇身跟随参数：
     * 1. 蛇节间距固定取蛇头尺寸（最短边）；
     * 2. 轨迹缓存以蛇头当前位置为起点。
     */
    private initializeBodyPath(): void {
        const headTransform = this._headNode.getComponent(UITransform);
        if (headTransform) {
            const headSize = headTransform.contentSize;
            this._segmentGap = Math.max(1, Math.min(headSize.width, headSize.height));
        }

        const headPos = this._headNode.position;
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
            const headPos = this._headNode.position;
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
                // 目标点位于当前线段上时，直接按比例插值返回，保证蛇身紧贴历史轨迹。
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
                // 只裁掉“超出保留距离”的更旧轨迹，保证尾部采样仍有足够历史点可用。
                cutIndex = index - 1;
                break;
            }
        }

        if (cutIndex > 0) {
            this._headPath.splice(0, cutIndex);
        }
    }

    /**
     * 销毁当前所有蛇身节点。
     */
    private destroyBodySegments(): void {
        // 蛇身节点不是蛇头子节点，需要手动回收避免场景残留。
        for (const segmentNode of this._bodySegments) {
            if (segmentNode.isValid) {
                segmentNode.destroy();
            }
        }
        this._bodySegments.length = 0;
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

        const bodyColor = this._getBodyColor();
        segmentGraphics.fillColor = new Color(bodyColor.r, bodyColor.g, bodyColor.b, bodyColor.a);

        const halfSize = segmentSize * 0.5;
        // 以锚点中心绘制方块，便于位置跟随逻辑复用。
        segmentGraphics.rect(-halfSize, -halfSize, segmentSize, segmentSize);
        segmentGraphics.fill();

        segmentNode.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
        return segmentNode;
    }
}
