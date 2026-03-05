import { _decorator, Component, EventKeyboard, input, Input, KeyCode, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 控制贪吃蛇头部节点，使用 WASD 键进行移动。
 */
@ccclass('SnakeHeadController')
export class SnakeHeadController extends Component {
    @property
    public moveSpeed = 200;

    private readonly _moveDirection: Vec3 = new Vec3(0, 0, 0);

    /**
     * 组件加载后注册键盘输入监听。
     */
    onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /**
     * 组件销毁前注销键盘输入监听。
     */
    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
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

        // 按方向、速度和帧间隔计算位移，保证不同帧率下移动速度一致。
        this.node.setPosition(
            currentPos.x + this._moveDirection.x * this.moveSpeed * deltaTime,
            currentPos.y + this._moveDirection.y * this.moveSpeed * deltaTime,
            currentPos.z,
        );
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
}
